import type { LDAIAgentConfig } from '../config';
import type { LDGraphEdge } from './types';

/**
 * Represents a single node within an agent graph.
 *
 * Each node wraps an {@link LDAIAgentConfig} and carries the outgoing edges
 * to its children. Use the node's tracker (via `getConfig().tracker`) to record
 * node-level metrics against the underlying agent config.
 */
export class AgentGraphNode {
  constructor(
    private readonly _key: string,
    private readonly _config: LDAIAgentConfig,
    private readonly _edges: LDGraphEdge[],
  ) {}

  /**
   * Returns the agent config key that identifies this node in the graph.
   */
  getKey(): string {
    return this._key;
  }

  /**
   * Returns the underlying AIAgentConfig for this node.
   * Use `getConfig().tracker` to record node-level metrics.
   */
  getConfig(): LDAIAgentConfig {
    return this._config;
  }

  /**
   * Returns the outgoing edges from this node to its children.
   */
  getEdges(): LDGraphEdge[] {
    return this._edges;
  }

  /**
   * Returns `true` if this node has no outgoing edges (i.e., it is a terminal/leaf node).
   */
  isTerminal(): boolean {
    return this._edges.length === 0;
  }
}
