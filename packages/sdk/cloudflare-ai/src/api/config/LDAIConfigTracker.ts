import type { LDFeedbackKind, LDTokenUsage } from '../metrics';

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
}
