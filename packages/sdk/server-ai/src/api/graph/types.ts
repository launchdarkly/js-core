import { LDJudgeResult } from '../judge/types';
import { LDAIMetrics, LDTokenUsage } from '../metrics';

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

// ============================================================================
// Runner-Level Graph Types
// ============================================================================

/**
 * Graph-level metrics for a completed graph run, as returned by a graph runner.
 * Does NOT include handoffs or evaluations — those are managed-layer concerns.
 */
export interface GraphMetrics {
  /**
   * Whether the graph invocation succeeded.
   */
  success: boolean;

  /**
   * Execution path through the graph as an ordered array of config keys.
   */
  path: string[];

  /**
   * Total graph execution duration in milliseconds, if tracked.
   */
  durationMs?: number;

  /**
   * Aggregate token usage across the entire graph invocation, if available.
   */
  usage?: LDTokenUsage;

  /**
   * Per-node metrics keyed by agent config key.
   */
  nodeMetrics: Record<string, LDAIMetrics>;
}

/**
 * The result returned by a graph runner invocation (provider-level).
 * Does NOT include evaluations or handoffs.
 */
export interface AgentGraphRunnerResult {
  /**
   * The text content of the graph's final response.
   */
  content: string;

  /**
   * Graph-level metrics for this invocation.
   */
  metrics: GraphMetrics;

  /**
   * The raw response object from the provider, if available.
   */
  raw?: unknown;
}

// ============================================================================
// Managed-Layer Graph Types
// ============================================================================

/**
 * Graph metric summary returned in ManagedGraphResult.
 * Includes per-node metrics and a resumption token.
 */
export interface GraphMetricSummary {
  /**
   * Whether the graph invocation succeeded.
   */
  success: boolean;

  /**
   * Execution path through the graph as an ordered array of config keys.
   */
  path: string[];

  /**
   * Total graph execution duration in milliseconds, if tracked.
   */
  durationMs?: number;

  /**
   * Aggregate token usage across the entire graph invocation, if available.
   */
  usage?: LDTokenUsage;

  /**
   * Per-node metrics keyed by agent config key.
   */
  nodeMetrics: Record<string, LDAIMetrics>;

  /**
   * Resumption token for deferred feedback association.
   */
  resumptionToken?: string;
}

/**
 * The result returned by a managed graph invocation (ManagedAgentGraph.run()).
 */
export interface ManagedGraphResult {
  /**
   * The text content of the graph's final response.
   */
  content: string;

  /**
   * Summarized metrics for this graph invocation.
   */
  metrics: GraphMetricSummary;

  /**
   * The raw response object from the provider, if available.
   */
  raw?: unknown;

  /**
   * Promise that resolves to the judge evaluation results.
   * Awaiting this promise guarantees both evaluation and tracking are complete.
   */
  evaluations: Promise<LDJudgeResult[]>;
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
