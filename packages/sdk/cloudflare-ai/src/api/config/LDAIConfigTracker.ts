import type { LDFeedbackKind, LDTokenUsage } from '../metrics';

export interface LDAIMetricSummary {
  durationMs?: number;
  tokens?: LDTokenUsage;
  success?: boolean;
  feedback?: { kind: LDFeedbackKind };
  timeToFirstTokenMs?: number;
}

/**
 * Tracker for AI configuration metrics and analytics.
 */
export interface LDAIConfigTracker {
  /**
   * Track a successful AI operation.
   */
  trackSuccess(): void;

  /**
   * Track an unsuccessful AI operation.
   */
  trackError(): void;

  /**
   * Track the duration of an AI operation in milliseconds.
   *
   * @param durationMs The duration in milliseconds.
   */
  trackDuration(durationMs: number): void;

  /**
   * Track comprehensive metrics for an AI operation.
   *
   * @param metrics Object containing duration, token usage, and success status.
   */
  trackMetrics(metrics: { durationMs: number; usage?: LDTokenUsage; success: boolean }): void;

  /**
   * Track only token usage for an AI operation.
   *
   * @param usage Token usage information.
   */
  trackTokens(usage: LDTokenUsage): void;

  /**
   * Track user feedback for an AI operation.
   *
   * @param kind The type of feedback (positive or negative).
   */
  trackFeedback(kind: LDFeedbackKind): void;

  /**
   * Track time to first token (TTFT) in milliseconds.
   *
   * @param timeToFirstTokenMs Milliseconds until first token.
   */
  trackTimeToFirstToken(timeToFirstTokenMs: number): void;

  trackDurationOf<T>(func: () => Promise<T>): Promise<T>;

  trackWorkersAIMetrics<
    T extends {
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        input_tokens?: number;
        output_tokens?: number;
      };
    },
  >(
    func: () => Promise<T>,
  ): Promise<T>;

  trackWorkersAIStreamMetrics<
    T extends {
      usage?: Promise<{
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        input_tokens?: number;
        output_tokens?: number;
      }>;
      finishReason?: Promise<string>;
    },
  >(
    func: () => T,
  ): T;

  getSummary(): LDAIMetricSummary;
}
