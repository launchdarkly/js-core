import { LDMessage } from '../config/LDAIConfig';
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

  /**
   * Additional metadata from the provider.
   */
  metadata?: Record<string, unknown>;
}
