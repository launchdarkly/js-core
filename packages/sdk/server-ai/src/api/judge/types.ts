import { LDAIMetrics } from '../metrics/LDAIMetrics';

/**
 * Structured response from AI models.
 */
export interface StructuredResponse {
  /** The structured data returned by the model */
  data: Record<string, unknown>;

  /** The raw response from the model */
  rawResponse: string;

  /**
   * Metrics information including success status and token usage.
   */
  metrics: LDAIMetrics;
}

/**
 * Score and reasoning for a single evaluation metric.
 */
export interface EvalScore {
  /** Score between 0.0 and 1.0 indicating the evaluation result for this metric */
  score: number;
  /** Reasoning behind the provided score for this metric */
  reasoning: string;
  /** The key of the judge configuration that was used to evaluate this metric */
  judgeConfigKey?: string;
}

/**
 * Response from a judge evaluation containing scores and reasoning for multiple metrics.
 */
export interface JudgeResponse {
  /** Dictionary where keys are metric names and values contain score and reasoning */
  evals: Record<string, EvalScore>;
  /** Whether the evaluation completed successfully */
  success: boolean;
  /** Error message if evaluation failed */
  error?: string;
}
