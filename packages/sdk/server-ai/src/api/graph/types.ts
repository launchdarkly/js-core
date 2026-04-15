import { LDTokenUsage } from '../metrics';

/**
 * Represents a directed edge in an agent graph, connecting a source node to a target node.
 */
export interface LDGraphEdge {
  /**
   * The key of the target AIAgentConfig node.
   */
  key: string;

  /**
   * Optional handoff options that customize how data flows between nodes.
   */
  handoff?: Record<string, unknown>;
}

/**
 * Raw flag value for an agent graph configuration as returned by LaunchDarkly.
 * This represents the data structure delivered by LaunchDarkly for graph configurations.
 */
export interface LDAgentGraphFlagValue {
  _ldMeta?: {
    variationKey?: string;
    version?: number;
    enabled?: boolean;
  };

  /**
   * The key of the root AIAgentConfig in the graph.
   */
  root: string;

  /**
   * Object mapping source agent config keys to arrays of target edges.
   */
  edges?: Record<string, LDGraphEdge[]>;
}

/**
 * Accumulated graph-level metrics collected by an LDGraphTracker.
 */
export interface LDGraphMetricSummary {
  /**
   * Whether the graph invocation succeeded. Absent if not yet tracked.
   */
  success?: boolean;

  /**
   * Total graph execution duration in milliseconds. Absent if not yet tracked.
   */
  durationMs?: number;

  /**
   * Aggregate token usage across the entire graph invocation. Absent if not yet tracked.
   */
  tokens?: LDTokenUsage;

  /**
   * Execution path through the graph as an array of config keys. Absent if not yet tracked.
   */
  path?: string[];
}

/**
 * Tracking metadata returned by {@link LDGraphTracker.getTrackData}.
 */
export interface LDGraphTrackData {
  /**
   * UUID v4 uniquely identifying this tracker and all events it emits.
   */
  runId: string;

  /**
   * The graph configuration key.
   */
  graphKey: string;

  /**
   * The variation key. Absent when a default config was used rather than a real flag evaluation.
   */
  variationKey?: string;

  /**
   * The version of the flag variation.
   */
  version: number;
}
