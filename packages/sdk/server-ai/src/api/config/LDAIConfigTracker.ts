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
   * Track the duration of generation.
   *
   * Ideally this would not include overhead time such as network communication.
   *
   * @param durationMs The duration in milliseconds.
   */
  trackDuration(durationMs: number): void;

  /**
   * Track information about token usage.
   *
   * @param tokens Token usage information.
   */
  trackTokens(tokens: LDTokenUsage): void;

  /**
   * Generation was successful.
   */
  trackSuccess(): void;

  /**
   * An error was encountered during generation.
   */
  trackError(): void;

  /**
   * Track sentiment about the generation.
   *
   * @param feedback Feedback about the generation.
   */
  trackFeedback(feedback: { kind: LDFeedbackKind }): void;

  /**
   * Track the time to first token for this generation.
   *
   * @param timeToFirstTokenMs The duration in milliseconds.
   */
  trackTimeToFirstToken(timeToFirstTokenMs: number): void;

  /**
   * Track the duration of execution of the provided function.
   *
   * If the provided function throws, then this method will also throw.
   * In the case the provided function throws, this function will still record the duration.
   *
   * This function does not automatically record an error when the function throws.
   *
   * @param func The function to track the duration of.
   * @returns The result of the function.
   */
  trackDurationOf(func: () => Promise<any>): Promise<any>;

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
   * @returns The result of the operation
   */
  trackMetricsOf<TRes>(
    metricsExtractor: (result: TRes) => LDAIMetrics,
    func: () => Promise<TRes>,
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
   * @returns The stream result (returned immediately, not a Promise)
   */
  trackStreamMetricsOf<TStream>(
    streamCreator: () => TStream,
    metricsExtractor: (stream: TStream) => Promise<LDAIMetrics>,
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
   * Track a Vercel AI SDK streamText operation.
   *
   * This function will track the duration of the operation, the token usage, and the success or error status.
   *
   * If the provided function throws, then this method will also throw.
   * In the case the provided function throws, this function will record the duration and an error.
   * A failed operation will not have any token usage data.
   *
   * @deprecated Use `trackStreamMetricsOf()` with `VercelProvider.createStreamMetricsExtractor()` from the
   * `@launchdarkly/server-sdk-ai-vercel` package instead. This method will be removed in a future version.
   *
   * @param func Function which executes the operation.
   * @returns The result of the operation.
   */
  trackVercelAISDKStreamTextMetrics<
    TRes extends {
      finishReason?: Promise<string>;
      usage?: Promise<{
        totalTokens?: number;
        inputTokens?: number;
        promptTokens?: number;
        outputTokens?: number;
        completionTokens?: number;
      }>;
    },
  >(
    func: () => TRes,
  ): TRes;

  /**
   * Get a summary of the tracked metrics.
   */
  getSummary(): LDAIMetricSummary;
}
