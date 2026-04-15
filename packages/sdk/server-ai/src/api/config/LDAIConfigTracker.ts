import { EvalScore, JudgeResponse } from '../judge/types';
import { LDAIMetrics, LDFeedbackKind, LDTokenUsage } from '../metrics';

/**
 * Metrics which have been tracked.
 */
export interface LDAIMetricSummary {
  /**
   * The duration of generation.
   */
  durationMs?: number;

  /**
   * Information about token usage.
   */
  tokens?: LDTokenUsage;

  /**
   * Was generation successful.
   */
  success?: boolean;

  /**
   * Any sentiment about the generation.
   */
  feedback?: { kind: LDFeedbackKind };

  /**
   * Time to first token for this generation.
   */
  timeToFirstTokenMs?: number;
}

/**
 * The LDAIConfigTracker is used to track various details about AI operations.
 */
export interface LDAIConfigTracker {
  /**
   * Get the data for tracking.
   *
   * @param graphKey When provided, associates this metric with the specified agent graph key.
   */
  getTrackData(graphKey?: string): {
    runId: string;
    configKey: string;
    variationKey: string;
    version: number;
    modelName: string;
    providerName: string;
    graphKey?: string;
  };

  /**
   * A URL-safe Base64-encoded token that encodes the tracker's runId, configKey,
   * variationKey, and version. Pass this to AIClient.createTracker() to reconstruct
   * the tracker across process boundaries (e.g. for associating deferred feedback
   * with the original invocation).
   */
  readonly resumptionToken: string;

  /**
   * Track the duration of generation.
   *
   * At-most-once per execution: subsequent calls on the same tracker are dropped
   * with a warning. Use createTracker() on the config result to obtain a fresh
   * tracker for a new execution.
   *
   * Ideally this would not include overhead time such as network communication.
   *
   * @param durationMs The duration in milliseconds.
   * @param graphKey When provided, associates this metric with the specified agent graph key.
   */
  trackDuration(durationMs: number, graphKey?: string): void;

  /**
   * Track information about token usage.
   *
   * At-most-once per execution: subsequent calls on the same tracker are dropped
   * with a warning.
   *
   * @param tokens Token usage information.
   * @param graphKey When provided, associates this metric with the specified agent graph key.
   */
  trackTokens(tokens: LDTokenUsage, graphKey?: string): void;

  /**
   * Generation was successful.
   *
   * At-most-once per execution: subsequent calls (including trackError) on the
   * same tracker are dropped with a warning.
   *
   * @param graphKey When provided, associates this metric with the specified agent graph key.
   */
  trackSuccess(graphKey?: string): void;

  /**
   * An error was encountered during generation.
   *
   * At-most-once per execution: subsequent calls (including trackSuccess) on the
   * same tracker are dropped with a warning.
   *
   * @param graphKey When provided, associates this metric with the specified agent graph key.
   */
  trackError(graphKey?: string): void;

  /**
   * Track sentiment about the generation.
   *
   * At-most-once per execution: subsequent calls on the same tracker are dropped
   * with a warning.
   *
   * @param feedback Feedback about the generation.
   * @param graphKey When provided, associates this metric with the specified agent graph key.
   */
  trackFeedback(feedback: { kind: LDFeedbackKind }, graphKey?: string): void;

  /**
   * Track the time to first token for this generation.
   *
   * At-most-once per execution: subsequent calls on the same tracker are dropped
   * with a warning.
   *
   * @param timeToFirstTokenMs The duration in milliseconds.
   * @param graphKey When provided, associates this metric with the specified agent graph key.
   */
  trackTimeToFirstToken(timeToFirstTokenMs: number, graphKey?: string): void;

  /**
   * Track evaluation scores for multiple metrics.
   *
   * @param scores Record mapping metric keys to their evaluation scores
   * @param graphKey When provided, associates this metric with the specified agent graph key.
   */
  trackEvalScores(scores: Record<string, EvalScore>, graphKey?: string): void;

  /**
   * Track a judge response containing evaluation scores and judge configuration key.
   *
   * @param response Judge response containing evaluation scores and judge configuration key
   * @param graphKey When provided, associates this metric with the specified agent graph key.
   */
  trackJudgeResponse(response: JudgeResponse, graphKey?: string): void;

  /**
   * Track a single tool invocation.
   *
   * @param toolKey The identifier of the tool that was invoked.
   * @param graphKey When provided, associates this metric with the specified agent graph key.
   */
  trackToolCall(toolKey: string, graphKey?: string): void;

  /**
   * Track multiple tool invocations.
   *
   * @param toolKeys The identifiers of the tools that were invoked.
   * @param graphKey When provided, associates this metric with the specified agent graph key.
   */
  trackToolCalls(toolKeys: string[], graphKey?: string): void;

  /**
   * Track the duration of execution of the provided function.
   *
   * If the provided function throws, then this method will also throw.
   * In the case the provided function throws, this function will still record the duration.
   *
   * This function does not automatically record an error when the function throws.
   *
   * @param func The function to track the duration of.
   * @param graphKey When provided, associates this metric with the specified agent graph key.
   * @returns The result of the function.
   */
  trackDurationOf(func: () => Promise<any>, graphKey?: string): Promise<any>;

  /**
   * Track metrics for a generic AI operation.
   *
   * This function will track the duration of the operation, extract metrics using the provided
   * metrics extractor function, and track success or error status accordingly.
   *
   * If the provided function throws, then this method will also throw.
   * In the case the provided function throws, this function will record the duration and an error.
   * A failed operation will not have any token usage data.
   *
   * @param metricsExtractor Function that extracts LDAIMetrics from the operation result
   * @param func Function which executes the operation
   * @param graphKey When provided, associates this metric with the specified agent graph key.
   * @returns The result of the operation
   */
  trackMetricsOf<TRes>(
    metricsExtractor: (result: TRes) => LDAIMetrics,
    func: () => Promise<TRes>,
    graphKey?: string,
  ): Promise<TRes>;

  /**
   * Track metrics for a streaming AI operation.
   *
   * This function will track the duration of the operation, extract metrics using the provided
   * metrics extractor function, and track success or error status accordingly.
   *
   * Unlike trackMetricsOf, this method is designed for streaming operations where:
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
   * @param graphKey When provided, associates this metric with the specified agent graph key.
   * @returns The stream result (returned immediately, not a Promise)
   */
  trackStreamMetricsOf<TStream>(
    streamCreator: () => TStream,
    metricsExtractor: (stream: TStream) => Promise<LDAIMetrics>,
    graphKey?: string,
  ): TStream;

  /**
   * Track an OpenAI operation.
   *
   * This function will track the duration of the operation, the token usage, and the success or error status.
   *
   * If the provided function throws, then this method will also throw.
   * In the case the provided function throws, this function will record the duration and an error.
   * A failed operation will not have any token usage data.
   *
   * @param func Function which executes the operation.
   * @returns The result of the operation.
   */
  trackOpenAIMetrics<
    TRes extends {
      usage?: {
        total_tokens?: number;
        prompt_tokens?: number;
        completion_tokens?: number;
      };
    },
  >(
    func: () => Promise<TRes>,
  ): Promise<TRes>;

  /**
   * Track an operation which uses Bedrock.
   *
   * This function will track the duration of the operation, the token usage, and the success or error status.
   *
   * @param res The result of the Bedrock operation.
   * @returns The input operation.
   */
  trackBedrockConverseMetrics<
    TRes extends {
      $metadata: { httpStatusCode?: number };
      metrics?: { latencyMs?: number };
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
      };
    },
  >(
    res: TRes,
  ): TRes;

  /**
   * Track a Vercel AI SDK generateText operation.
   *
   * This function will track the duration of the operation, the token usage, and the success or error status.
   *
   * If the provided function throws, then this method will also throw.
   * In the case the provided function throws, this function will record the duration and an error.
   * A failed operation will not have any token usage data.
   *
   * @param func Function which executes the operation.
   * @returns The result of the operation.
   */
  trackVercelAISDKGenerateTextMetrics<
    TRes extends {
      usage?: {
        totalTokens?: number;
        inputTokens?: number;
        promptTokens?: number;
        outputTokens?: number;
        completionTokens?: number;
      };
    },
  >(
    func: () => Promise<TRes>,
  ): Promise<TRes>;

  /**
   * Get a summary of the tracked metrics.
   */
  getSummary(): LDAIMetricSummary;
}
