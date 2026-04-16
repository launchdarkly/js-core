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
 * Flat result from a judge evaluation containing score, reasoning, and metadata.
 */
export interface LDJudgeResult {
  /** The key of the judge configuration that was used to generate this result */
  judgeConfigKey?: string;
  /** Whether the evaluation completed successfully */
  success: boolean;
  /** Error message if evaluation failed */
  errorMessage?: string;
  /** Whether this evaluation was sampled (i.e. actually run). False when skipped by sampling. */
  sampled: boolean;
  /** Score between 0.0 and 1.0 indicating the evaluation result */
  score?: number;
  /** Reasoning behind the provided score */
  reasoning?: string;
  /** The metric key for this evaluation */
  metricKey?: string;
}
