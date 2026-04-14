import { JudgeResponse } from '../judge/types';
import { LDTokenUsage } from '../metrics';

/**
 * Metrics tracked at the graph level.
 */
export interface LDGraphMetricSummary {
  /**
   * True if the graph invocation succeeded, false if it failed, absent if not tracked.
   */
  success?: boolean;

  /**
   * Total graph execution duration in milliseconds, if tracked.
   */
  durationMs?: number;

  /**
   * Aggregated token usage across the entire graph invocation, if tracked.
   */
  tokens?: LDTokenUsage;

  /**
   * Execution path through the graph as an array of config keys, if tracked.
   */
  path?: string[];
}

/**
 * Tracker for graph-level and edge-level metrics in AI agent graph operations.
 *
 * Node-level metrics are tracked via each node's {@link LDAIConfigTracker}.
 */
export interface LDGraphTracker {
  /**
   * Get the data for tracking.
   */
  getTrackData(): {
    variationKey: string;
    graphKey: string;
    version: number;
  };

  /**
   * Track a successful graph invocation.
   *
   * At-most-once per tracker instance. Subsequent calls are dropped.
   */
  trackInvocationSuccess(): void;

  /**
   * Track an unsuccessful graph invocation.
   *
   * At-most-once per tracker instance. Subsequent calls are dropped.
   */
  trackInvocationFailure(): void;

  /**
   * Track the total latency of graph execution.
   *
   * At-most-once per tracker instance. Subsequent calls are dropped.
   *
   * @param durationMs Duration in milliseconds.
   */
  trackLatency(durationMs: number): void;

  /**
   * Track aggregated token usage across the entire graph invocation.
   *
   * At-most-once per tracker instance. Subsequent calls are dropped.
   *
   * @param tokens Token usage information.
   */
  trackTotalTokens(tokens: LDTokenUsage): void;

  /**
   * Track the execution path through the graph.
   *
   * At-most-once per tracker instance. Subsequent calls are dropped.
   *
   * @param path Array of config keys representing the sequence of nodes executed.
   */
  trackPath(path: string[]): void;

  /**
   * Track judge responses for the final graph output.
   *
   * @param response Judge response containing evaluation scores.
   */
  trackJudgeResponse(response: JudgeResponse): void;

  /**
   * Track when a node redirects to a different target than originally specified.
   *
   * May be called multiple times.
   *
   * @param sourceKey Config key of the source node.
   * @param redirectedTarget Config key of the target node that was redirected to.
   */
  trackRedirect(sourceKey: string, redirectedTarget: string): void;

  /**
   * Track a successful handoff between nodes.
   *
   * May be called multiple times.
   *
   * @param sourceKey Config key of the source node.
   * @param targetKey Config key of the target node.
   */
  trackHandoffSuccess(sourceKey: string, targetKey: string): void;

  /**
   * Track a failed handoff between nodes.
   *
   * May be called multiple times.
   *
   * @param sourceKey Config key of the source node.
   * @param targetKey Config key of the target node.
   */
  trackHandoffFailure(sourceKey: string, targetKey: string): void;

  /**
   * Get a summary of the tracked graph-level metrics.
   */
  getSummary(): LDGraphMetricSummary;
}
