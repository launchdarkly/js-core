import type { LDAIAgentConfig } from '../config';
import { AgentGraphNode } from './AgentGraphNode';
import type { LDGraphTracker } from './LDGraphTracker';
import type { LDAgentGraphFlagValue, LDGraphEdge } from './types';

/**
 * Callback function signature for graph traversal methods.
 */
export type TraversalFn = (
  node: AgentGraphNode,
  executionContext: Record<string, unknown>,
) => unknown;

/**
 * Encapsulates an agent graph configuration and its pre-built node collection.
 *
 * Provides graph-level orchestration including relationship queries (parent/child),
 * topological traversal in both forward and reverse directions, and graph tracker creation.
 *
 * Obtain an instance via {@link LDAIClient.agentGraph}. When the graph is disabled
 * or invalid, the returned instance has {@link enabled} set to `false` and an
 * empty node collection.
 */
export class AgentGraphDefinition {
  constructor(
    private readonly _agentGraph: LDAgentGraphFlagValue,
    private readonly _nodes: Record<string, AgentGraphNode>,
    readonly enabled: boolean,
    private readonly _createTracker: () => LDGraphTracker,
  ) {}

  /**
   * Builds a node map from a raw agent graph flag value and a map of pre-fetched agent configs.
   *
   * @param graph Raw graph flag value from LaunchDarkly.
   * @param agentConfigs Map of agent config key to resolved LDAIAgentConfig.
   * @returns Record mapping agent config keys to AgentGraphNode instances.
   */
  static buildNodes(
    graph: LDAgentGraphFlagValue,
    agentConfigs: Record<string, LDAIAgentConfig>,
  ): Record<string, AgentGraphNode> {
    const nodes: Record<string, AgentGraphNode> = {};
    const allKeys = AgentGraphDefinition.collectAllKeys(graph);

    allKeys.forEach((key) => {
      const config = agentConfigs[key];
      if (!config) {
        return;
      }
      const outgoingEdges: LDGraphEdge[] = graph.edges?.[key] ?? [];
      nodes[key] = new AgentGraphNode(key, config, outgoingEdges);
    });

    return nodes;
  }

  /**
   * Returns the children of the node identified by `nodeKey`.
   *
   * @param nodeKey The agent config key of the parent node.
   */
  getChildNodes(nodeKey: string): AgentGraphNode[] {
    const node = this._nodes[nodeKey];
    if (!node) {
      return [];
    }
    return node
      .getEdges()
      .map((edge) => this._nodes[edge.key])
      .filter((n): n is AgentGraphNode => n !== undefined);
  }

  /**
   * Returns all nodes that have a direct edge to the node identified by `nodeKey`.
   *
   * @param nodeKey The agent config key of the child node.
   */
  getParentNodes(nodeKey: string): AgentGraphNode[] {
    return Object.values(this._nodes).filter((node) =>
      node.getEdges().some((edge) => edge.key === nodeKey),
    );
  }

  /**
   * Returns all terminal nodes (nodes with no outgoing edges).
   */
  terminalNodes(): AgentGraphNode[] {
    return Object.values(this._nodes).filter((node) => node.isTerminal());
  }

  /**
   * Returns the root node of the graph.
   */
  rootNode(): AgentGraphNode {
    return this._nodes[this._agentGraph.root];
  }

  /**
   * Returns the node with the given key, or `null` if not found.
   *
   * @param nodeKey The agent config key to look up.
   */
  getNode(nodeKey: string): AgentGraphNode | null {
    return this._nodes[nodeKey] ?? null;
  }

  /**
   * Returns the underlying raw graph configuration from LaunchDarkly.
   */
  getConfig(): LDAgentGraphFlagValue {
    return this._agentGraph;
  }

  /**
   * Returns a new {@link LDGraphTracker} for a fresh graph run.
   *
   * Call this once per graph run. Each call produces a tracker with a fresh `runId`
   * that groups all events for that run.
   */
  createTracker(): LDGraphTracker {
    return this._createTracker();
  }

  /**
   * Traverses the graph in topological order from the root (predecessors-first).
   *
   * A node is visited only after every reachable predecessor has been visited.
   * The root is visited first. When multiple nodes are simultaneously eligible,
   * they are visited in graph-discovery order (BFS from root following declared
   * edge order) for determinism. Cyclic graphs are cycle-safe — each reachable
   * node is visited exactly once.
   *
   * Each call to `fn` receives a fresh context containing the caller-provided
   * `initialExecutionContext` plus the return values of exactly that node's
   * reachable predecessors — not results from unrelated parallel-branch nodes.
   *
   * @param fn Callback invoked for each node. Its return value is stored under
   *   the node's config key for use by dependent nodes.
   * @param initialExecutionContext Optional initial context visible to every node.
   */
  traverse(fn: TraversalFn, initialExecutionContext: Record<string, unknown> = {}): void {
    const root = this.rootNode();
    if (!root) {
      return;
    }

    const { reachable, order } = this._reachableAndDiscovery(root.getKey());

    const indeg = new Map<string, number>();
    reachable.forEach((k) => indeg.set(k, 0));
    reachable.forEach((k) => {
      this._nodes[k]!.getEdges().forEach((e) => {
        if (reachable.has(e.key)) {
          indeg.set(e.key, indeg.get(e.key)! + 1);
        }
      });
    });
    indeg.set(root.getKey(), 0);

    const visited = new Set<string>();
    const results: Record<string, unknown> = {};
    const ancestors = new Map<string, Set<string>>();
    const scoped = (deps: Set<string>) => {
      const c: Record<string, unknown> = { ...initialExecutionContext };
      deps.forEach((k) => {
        c[k] = results[k];
      });
      return c;
    };

    while (visited.size < reachable.size) {
      let next = order.find((k) => !visited.has(k) && indeg.get(k)! === 0);
      if (next === undefined) {
        // Cycle break: lowest remaining in-degree, tie-broken by discovery order
        next = order
          .filter((k) => !visited.has(k))
          .sort((a, b) => indeg.get(a)! - indeg.get(b)!)[0];
      }

      const anc = new Set<string>();
      this.getParentNodes(next).forEach((p) => {
        const pk = p.getKey();
        if (!visited.has(pk)) {
          return;
        }
        anc.add(pk);
        ancestors.get(pk)?.forEach((a) => anc.add(a));
      });
      ancestors.set(next, anc);
      visited.add(next);

      results[next] = fn(this._nodes[next]!, scoped(anc));
      this._nodes[next]!.getEdges().forEach((e) => {
        if (reachable.has(e.key)) {
          indeg.set(e.key, indeg.get(e.key)! - 1);
        }
      });
    }
  }

  /**
   * Traverses the graph in reverse topological order (descendants-first).
   *
   * A node is visited only after every reachable descendant has been visited.
   * The root is always visited last. When multiple nodes are simultaneously
   * eligible, they are visited in graph-discovery order for determinism. Cyclic
   * graphs are cycle-safe — each reachable node is visited exactly once (including
   * graphs with no terminal nodes).
   *
   * Each call to `fn` receives a fresh context containing the caller-provided
   * `initialExecutionContext` plus the return values of exactly that node's
   * reachable descendants — not results from unrelated parallel-branch nodes.
   *
   * @param fn Callback invoked for each node. Its return value is stored under
   *   the node's config key for use by dependent nodes.
   * @param initialExecutionContext Optional initial context visible to every node.
   */
  reverseTraverse(fn: TraversalFn, initialExecutionContext: Record<string, unknown> = {}): void {
    const root = this.rootNode();
    if (!root) {
      return;
    }

    const rootKey = root.getKey();
    const { reachable, order } = this._reachableAndDiscovery(rootKey);

    const outdeg = new Map<string, number>();
    reachable.forEach((k) => {
      outdeg.set(k, this._nodes[k]!.getEdges().filter((e) => reachable.has(e.key)).length);
    });

    const visited = new Set<string>();
    const results: Record<string, unknown> = {};
    const descendants = new Map<string, Set<string>>();
    const scoped = (deps: Set<string>) => {
      const c: Record<string, unknown> = { ...initialExecutionContext };
      deps.forEach((k) => {
        c[k] = results[k];
      });
      return c;
    };

    const nonRootRemaining = () => [...reachable].some((k) => k !== rootKey && !visited.has(k));
    while (nonRootRemaining()) {
      let next = order.find((k) => k !== rootKey && !visited.has(k) && outdeg.get(k)! === 0);
      if (next === undefined) {
        // Cycle break: lowest remaining out-degree, tie-broken by discovery order
        next = order
          .filter((k) => k !== rootKey && !visited.has(k))
          .sort((a, b) => outdeg.get(a)! - outdeg.get(b)!)[0];
      }

      const desc = new Set<string>();
      this._nodes[next]!.getEdges().forEach((e) => {
        if (!reachable.has(e.key) || !visited.has(e.key)) {
          return;
        }
        desc.add(e.key);
        descendants.get(e.key)?.forEach((d) => desc.add(d));
      });
      descendants.set(next, desc);
      visited.add(next);

      results[next] = fn(this._nodes[next]!, scoped(desc));
      this.getParentNodes(next).forEach((p) => {
        const pk = p.getKey();
        if (pk !== rootKey && reachable.has(pk)) {
          outdeg.set(pk, outdeg.get(pk)! - 1);
        }
      });
    }

    // Root last; depends on every reachable non-root node
    const rootDeps = new Set<string>([...reachable].filter((k) => k !== rootKey));
    visited.add(rootKey);
    results[rootKey] = fn(root, scoped(rootDeps));
  }

  /**
   * Reachable set from root plus deterministic discovery order (BFS following
   * declared edge order, root first). Used as a tie-break for topological traversal.
   */
  private _reachableAndDiscovery(rootKey: string): { reachable: Set<string>; order: string[] } {
    const reachable = new Set<string>();
    const order: string[] = [];
    const queue: string[] = [rootKey];
    reachable.add(rootKey);
    order.push(rootKey);

    while (queue.length > 0) {
      const key = queue.shift()!;
      const node = this._nodes[key];
      if (!node) {
        continue;
      }
      node.getEdges().forEach((edge) => {
        if (this._nodes[edge.key] && !reachable.has(edge.key)) {
          reachable.add(edge.key);
          order.push(edge.key);
          queue.push(edge.key);
        }
      });
    }

    return { reachable, order };
  }

  /**
   * Collects every unique node key referenced in the graph (root + all edge sources
   * and targets).
   */
  static collectAllKeys(graph: LDAgentGraphFlagValue): Set<string> {
    const keys = new Set<string>();
    keys.add(graph.root);

    if (graph.edges) {
      Object.entries(graph.edges).forEach(([sourceKey, edges]) => {
        keys.add(sourceKey);
        edges.forEach((edge) => {
          keys.add(edge.key);
        });
      });
    }

    return keys;
  }
}
