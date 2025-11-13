import { LDMessage } from '../config/types';
import { JudgeResponse } from '../judge/types';
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
   * Promise that resolves to judge evaluation results.
   * Only present when judges are configured for evaluation.
   */
  evaluations?: Promise<Array<JudgeResponse | undefined>>;
}
