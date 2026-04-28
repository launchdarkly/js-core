import { LDTokenUsage } from './LDTokenUsage';

/**
 * Metrics information for AI operations that includes success status and token usage.
 * This class combines success/failure tracking with token usage metrics.
 */
export interface LDAIMetrics {
  /**
   * Whether the AI operation was successful.
   */
  success: boolean;

  /**
   * Token usage information for the operation.
   * This will be undefined if no token usage data is available.
   */
  usage?: LDTokenUsage;

  /**
   * List of tool call identifiers made during the operation.
   * This will be undefined if no tool calls were made.
   */
  toolCalls?: string[];

  /**
   * Duration of the operation in milliseconds.
   * This will be undefined if duration was not tracked.
   */
  durationMs?: number;
}
