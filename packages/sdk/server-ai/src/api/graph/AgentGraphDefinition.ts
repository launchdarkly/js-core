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
 * breadth-first traversal in both forward and reverse directions, and tracker creation.
 *
 * Obtain an instance via {@link LDAIClient.agentGraph}.
 */
export class AgentGraphDefinition {
  constructor(
    private readonly _agentGraph: LDAgentGraphFlagValue,
    private readonly _nodes: Record<string, AgentGraphNode>,
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
   * Whether the graph is enabled. Always `true` for a successfully constructed definition
   * (disabled graphs are not surfaced as AgentGraphDefinition instances).
   */
  get enabled(): boolean {
    // eslint-disable-next-line no-underscore-dangle
    return this._agentGraph._ldMeta?.enabled ?? true;
  }

  /**
   * Returns whether the graph is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
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
   * Returns a new {@link LDGraphTracker} for this graph invocation.
   *
   * Call this once per invocation. Each call produces a tracker with a fresh `runId`
   * that groups all events for that invocation.
   */
  createTracker(): LDGraphTracker {
    return this._createTracker();
  }

  /**
   * Traverses the graph breadth-first from the root to all terminal nodes.
   *
   * Nodes at the same depth are processed before advancing to the next depth.
   * The value returned by `fn` is stored in the mutable `executionContext` under
   * the node's key, making upstream results available to downstream nodes.
   *
   * Cyclic graphs are handled safely — each node is visited at most once.
   *
   * @param fn Callback invoked for each node. Its return value is added to
   *   `executionContext` keyed by the node's config key.
   * @param initialExecutionContext Optional initial context to seed the traversal.
   */
  traverse(fn: TraversalFn, initialExecutionContext: Record<string, unknown> = {}): void {
    const root = this.rootNode();
    if (!root) {
      return;
    }

    const executionContext = { ...initialExecutionContext };
    const visited = new Set<string>();
    const queue: AgentGraphNode[] = [root];
    visited.add(root.getKey());

    while (queue.length > 0) {
      const node = queue.shift()!;
      const result = fn(node, executionContext);
      executionContext[node.getKey()] = result;

      node.getEdges().forEach((edge) => {
        if (!visited.has(edge.key)) {
          const child = this._nodes[edge.key];
          if (child) {
            visited.add(edge.key);
            queue.push(child);
          }
        }
      });
    }
  }

  /**
   * Traverses the graph from terminal nodes up to the root.
   *
   * Uses BFS upward via parent edges so that each node is processed only after
   * all of its reachable descendants have been processed. The root is always
   * visited last. Cyclic graphs are handled safely — each node is visited at
   * most once; if the graph has no terminal nodes, this method returns without
   * invoking `fn`.
   *
   * The value returned by `fn` is stored in the mutable `executionContext` under
   * the node's key.
   *
   * @param fn Callback invoked for each node. Its return value is added to
   *   `executionContext` keyed by the node's config key.
   * @param initialExecutionContext Optional initial context to seed the traversal.
   */
  reverseTraverse(fn: TraversalFn, initialExecutionContext: Record<string, unknown> = {}): void {
    const terminals = this.terminalNodes();
    if (terminals.length === 0) {
      return;
    }

    const executionContext = { ...initialExecutionContext };
    const rootKey = this._agentGraph.root;
    const visited = new Set<string>();
    let queue: AgentGraphNode[] = terminals;

    while (queue.length > 0) {
      const nextQueue: AgentGraphNode[] = [];

      queue.forEach((node) => {
        const key = node.getKey();
        if (visited.has(key)) {
          return;
        }
        visited.add(key);

        // Defer the root so it is always processed last
        if (key === rootKey) {
          return;
        }

        const result = fn(node, executionContext);
        executionContext[key] = result;

        this.getParentNodes(key).forEach((parent) => {
          if (!visited.has(parent.getKey())) {
            nextQueue.push(parent);
          }
        });
      });

      queue = nextQueue;
    }

    // Root is always last — only invoke if it was reached during traversal
    const root = this._nodes[rootKey];
    if (root && visited.has(rootKey)) {
      const result = fn(root, executionContext);
      executionContext[rootKey] = result;
    }
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
