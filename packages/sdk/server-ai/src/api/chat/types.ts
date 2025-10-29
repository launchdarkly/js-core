import { LDMessage } from '../config/types';
import { LDAIMetrics } from '../metrics/LDAIMetrics';

/**
 * Chat response structure.
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
