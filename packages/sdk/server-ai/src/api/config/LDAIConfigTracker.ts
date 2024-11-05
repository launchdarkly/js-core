import { LDFeedbackKind, LDTokenUsage } from '../metrics';

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
   * Track sentiment about the generation.
   *
   * @param feedback Feedback about the generation.
   */
  trackFeedback(feedback: { kind: LDFeedbackKind }): void;

  /**
   * Track the duration of execution of the provided function.
   * @param func The function to track the duration of.
   * @returns The result of the function.
   */
  trackDurationOf(func: () => Promise<any>): Promise<any>;

  /**
   * Track an OpenAI operation.
   *
   * @param func Function which executes the operation.
   * @returns The result of the operation.
   */
  trackOpenAI<
    TRes extends {
      usage?: {
        total_tokens?: number;
        prompt_token?: number;
        completion_token?: number;
      };
    },
  >(
    func: () => Promise<TRes>,
  ): Promise<TRes>;

  /**
   * Track an operation which uses Bedrock.
   *
   * @param res The result of the Bedrock operation.
   * @returns The input operation.
   */
  trackBedrockConverse<
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
}
