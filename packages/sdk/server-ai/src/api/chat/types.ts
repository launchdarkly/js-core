import { LDMessage } from '../config/types';
import { LDAIMetrics } from '../metrics/LDAIMetrics';

/**
 * Chat response structure returned by provider implementations.
 * This is the runner-level type; evaluations belong in ManagedResult.
 */
export interface ChatResponse {
  /**
   * The response message from the AI.
   */
  message: LDMessage;

  /**
   * Metrics information including success status and token usage.
   */
  metrics: LDAIMetrics;
}
