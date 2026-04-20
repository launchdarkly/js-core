import type { LDJudgeResult } from '../judge/types';
import type { LDTokenUsage } from '../metrics';
import type { LDGraphMetricSummary, LDGraphTrackData } from './types';

/**
 * Tracks graph-level and edge-level metrics for an agent graph invocation.
 *
 * Graph-level methods enforce at-most-once semantics: calling the same method
 * twice on a tracker instance drops the second call and emits a warning.
 * Edge-level methods (trackRedirect, trackHandoffSuccess, trackHandoffFailure)
 * are multi-fire and are not subject to this constraint.
 *
 * @example
 * ```typescript
 * const tracker = graphDefinition.createTracker();
 * try {
 *   // ... execute graph ...
 *   tracker.trackInvocationSuccess();
 *   tracker.trackLatency(durationMs);
 * } catch {
 *   tracker.trackInvocationFailure();
 * }
 * ```
 */
export interface LDGraphTracker {
  /**
   * Returns tracking metadata to be included in every LDClient.track call.
   */
  getTrackData(): LDGraphTrackData;

  /**
   * Returns a snapshot of all graph-level metrics tracked so far.
   */
  getSummary(): LDGraphMetricSummary;

  /**
   * A URL-safe Base64-encoded (RFC 4648, no padding) token encoding the tracker's
   * identity. Pass this token to {@link LDGraphTrackerImpl.fromResumptionToken} to
   * reconstruct the tracker across process boundaries, preserving the original runId.
   *
   * **Security note:** The token contains the flag variation key and version. If passed
   * to an untrusted client (e.g., a browser) this could expose feature-flag targeting
   * details. Keep the token server-side and use an opaque reference in client-facing APIs.
   */
  readonly resumptionToken: string;

  // -------------------------------------------------------------------------
  // Graph-level tracking methods (at-most-once per tracker instance)
  // -------------------------------------------------------------------------

  /**
   * Tracks a successful graph invocation.
   * Emits event `$ld:ai:graph:invocation_success` with metric value `1`.
   * At-most-once: subsequent calls are dropped with a warning.
   */
  trackInvocationSuccess(): void;

  /**
   * Tracks an unsuccessful graph invocation.
   * Emits event `$ld:ai:graph:invocation_failure` with metric value `1`.
   * At-most-once: subsequent calls are dropped with a warning.
   */
  trackInvocationFailure(): void;

  /**
   * Tracks the total latency of the graph execution in milliseconds.
   * Emits event `$ld:ai:graph:latency` with the duration as the metric value.
   * At-most-once: subsequent calls are dropped with a warning.
   *
   * @param durationMs Duration in milliseconds.
   */
  trackLatency(durationMs: number): void;

  /**
   * Tracks aggregate token usage across the entire graph invocation.
   * Emits event `$ld:ai:graph:total_tokens` with the total token count as the metric value.
   * At-most-once: subsequent calls are dropped with a warning.
   *
   * @param tokens Token usage information.
   */
  trackTotalTokens(tokens: LDTokenUsage): void;

  /**
   * Tracks the execution path through the graph.
   * Emits event `$ld:ai:graph:path` with metric value `1`.
   * The data payload includes the path array in addition to standard track data.
   * At-most-once: subsequent calls are dropped with a warning.
   *
   * @param path An ordered array of agent config keys representing the execution path.
   */
  trackPath(path: string[]): void;

  /**
   * Tracks a judge evaluation result for the final graph output.
   * Emits one LDClient.track call when the result was sampled and successful.
   * Not subject to at-most-once constraints.
   *
   * @param result Judge result containing score, reasoning, and metadata.
   */
  trackJudgeResult(result: LDJudgeResult): void;

  // -------------------------------------------------------------------------
  // Edge-level tracking methods (multi-fire, not at-most-once)
  // -------------------------------------------------------------------------

  /**
   * Tracks when a node redirects to a different target than originally specified.
   * Emits event `$ld:ai:graph:redirect` with metric value `1`.
   *
   * @param sourceKey Config key of the source node.
   * @param redirectedTarget Config key of the actual target node.
   */
  trackRedirect(sourceKey: string, redirectedTarget: string): void;

  /**
   * Tracks a successful handoff between two nodes.
   * Emits event `$ld:ai:graph:handoff_success` with metric value `1`.
   *
   * @param sourceKey Config key of the source node.
   * @param targetKey Config key of the target node.
   */
  trackHandoffSuccess(sourceKey: string, targetKey: string): void;

  /**
   * Tracks a failed handoff between two nodes.
   * Emits event `$ld:ai:graph:handoff_failure` with metric value `1`.
   *
   * @param sourceKey Config key of the source node.
   * @param targetKey Config key of the target node.
   */
  trackHandoffFailure(sourceKey: string, targetKey: string): void;
}
