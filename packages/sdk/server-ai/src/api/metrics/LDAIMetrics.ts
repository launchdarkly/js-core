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
}
