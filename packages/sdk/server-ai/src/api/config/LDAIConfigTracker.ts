import { LDJudgeResult } from '../judge/types';
import { LDAIMetrics, LDFeedbackKind, LDTokenUsage } from '../metrics';
import { LDAIMetricSummary } from '../model/types';

/**
 * The LDAIConfigTracker records metrics for a single AI run.
 *
 * All events a tracker emits share a runId (a UUIDv4) so LaunchDarkly can
 * correlate them in metrics views. See individual track methods for their
 * specific semantics. Call `createTracker` on the AI Config to start a new
 * run. A resumption token preserves the runId, so events emitted by a
 * tracker reconstructed in another process correlate with the original run.
 */
export interface LDAIConfigTracker {
  /**
   * Get the data for tracking.
   */
  getTrackData(): {
    runId: string;
    configKey: string;
    variationKey: string;
    version: number;
    modelName: string;
    providerName: string;
    modelVersion: number;
    modelKey?: string;
    graphKey?: string;
  };

  /**
   * A URL-safe Base64-encoded token that encodes the tracker's runId, configKey,
   * variationKey, and version. Pass this to AIClient.createTracker() to reconstruct
   * the tracker across process boundaries (e.g. for associating deferred feedback
   * with the original AI run).
   */
  readonly resumptionToken: string;

  /**
   * Track the duration of generation.
   *
   * Ideally this would not include overhead time such as network communication.
   *
   * @param durationMs The duration in milliseconds.
   *
   * @remarks Records at most once per Tracker; further calls are ignored.
   */
  trackDuration(durationMs: number): void;

  /**
   * Track information about token usage.
   *
   * @param tokens Token usage information.
   *
   * @remarks Records at most once per Tracker; further calls are ignored.
   */
  trackTokens(tokens: LDTokenUsage): void;

  /**
   * Generation was successful.
   *
   * @remarks Records at most once per Tracker. trackSuccess and trackError share
   * state; only one of the two can record per Tracker, and subsequent calls are
   * ignored.
   */
  trackSuccess(): void;

  /**
   * An error was encountered during generation.
   *
   * @remarks Records at most once per Tracker. trackSuccess and trackError share
   * state; only one of the two can record per Tracker, and subsequent calls are
   * ignored.
   */
  trackError(): void;

  /**
   * Track sentiment about the generation.
   *
   * @param feedback Feedback about the generation.
   *
   * @remarks Records at most once per Tracker; further calls are ignored.
   */
  trackFeedback(feedback: { kind: LDFeedbackKind }): void;

  /**
   * Track the time to first token for this generation.
   *
   * @param timeToFirstTokenMs The duration in milliseconds.
   *
   * @remarks Records at most once per Tracker; further calls are ignored.
   */
  trackTimeToFirstToken(timeToFirstTokenMs: number): void;

  /**
   * Track a judge evaluation result.
   *
   * No event is emitted when the result was not sampled (result.sampled is false).
   *
   * @param result Judge result containing score, reasoning, and metadata
   *
   * @remarks May be called multiple times per Tracker; each call records the
   * scores from the given response.
   */
  trackJudgeResult(result: LDJudgeResult): void;

  /**
   * Track a single tool invocation.
   *
   * @param toolKey The identifier of the tool that was invoked.
   *
   * @remarks May be called multiple times per Tracker; each call records the
   * given tool call.
   */
  trackToolCall(toolKey: string): void;

  /**
   * Track multiple tool invocations.
   *
   * @param toolKeys The identifiers of the tools that were invoked.
   *
   * @remarks May be called multiple times per Tracker; each call records the
   * given tool calls.
   */
  trackToolCalls(toolKeys: string[]): void;

  /**
   * Track the duration of the provided function.
   *
   * If the provided function throws, then this method will also throw.
   * In the case the provided function throws, this function will still record the duration.
   *
   * This function does not automatically record an error when the function throws.
   *
   * @param func The function to track the duration of.
   * @returns The result of the function.
   *
   * @remarks Because each inner metric is at-most-once per Tracker, calling
   * this twice on the same Tracker will run the inner function again but
   * produce no additional metric events.
   */
  trackDurationOf(func: () => Promise<any>): Promise<any>;

  /**
   * Track metrics for a generic AI operation.
   *
   * This function will track the duration of the AI run, extract metrics using the provided
   * metrics extractor function, and track success or error status accordingly.
   *
   * If the provided function throws, then this method will also throw.
   * In the case the provided function throws, this function will record the duration and an error.
   * A failed AI run will not have any token usage data.
   *
   * @param metricsExtractor Function that extracts LDAIMetrics from the AI run result
   * @param func Function which executes the AI run
   * @returns The result of the AI run
   *
   * @remarks Subsequent calls re-run the inner function but emit only metrics
   * not already recorded on this Tracker. Call createTracker on the AI Config
   * to start a new run.
   */
  trackMetricsOf<TRes>(
    metricsExtractor: (result: TRes) => LDAIMetrics,
    func: () => Promise<TRes>,
  ): Promise<TRes>;

  /**
   * Track metrics for a streaming AI operation.
   *
   * This function will track the duration of the AI run, extract metrics using the provided
   * metrics extractor function, and track success or error status accordingly.
   *
   * Unlike trackMetricsOf, this method is designed for streaming AI runs where:
   * - The stream is created and returned immediately (synchronously)
   * - Metrics are extracted asynchronously in the background once the stream completes
   * - Duration is tracked from stream creation to metrics extraction completion
   *
   * The stream is returned immediately so the caller can begin consuming it without waiting.
   * Metrics extraction happens in the background and does not block stream consumption.
   *
   * If the stream creator throws, then this method will also throw and record an error.
   * If metrics extraction fails, the error is logged but does not affect stream consumption.
   *
   * @param streamCreator Function that creates and returns the stream (synchronous)
   * @param metricsExtractor Function that asynchronously extracts metrics from the stream
   * @returns The stream result (returned immediately, not a Promise)
   *
   * @remarks Subsequent calls re-run the inner function but emit only metrics
   * not already recorded on this Tracker. Call createTracker on the AI Config
   * to start a new run.
   */
  trackStreamMetricsOf<TStream>(
    streamCreator: () => TStream,
    metricsExtractor: (stream: TStream) => Promise<LDAIMetrics>,
  ): TStream;

  /**
   * Get a summary of the tracked metrics.
   */
  getSummary(): LDAIMetricSummary;
}
