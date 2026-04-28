import { LDJudgeResult } from '../judge/types';
import { LDAIMetrics } from '../metrics/LDAIMetrics';
import { LDTokenUsage } from '../metrics/LDTokenUsage';

/**
 * Summary metrics returned in a ManagedResult or ManagedGraphResult.
 * Provides a flat view of the key metrics for the completed operation.
 */
export interface LDAIMetricSummary {
  /**
   * Whether the AI operation was successful.
   */
  success: boolean;

  /**
   * Token usage information, if available.
   */
  usage?: LDTokenUsage;

  /**
   * List of tool call identifiers made during the operation, if any.
   */
  toolCalls?: string[];

  /**
   * Duration of the operation in milliseconds, if tracked.
   */
  durationMs?: number;

  /**
   * Resumption token for deferred feedback association.
   */
  resumptionToken?: string;
}

/**
 * The result returned by a Runner (provider-level) invocation.
 * Providers implement Runner and return RunnerResult from run().
 * This type does NOT include evaluations — those are wired in the managed layer.
 */
export interface RunnerResult {
  /**
   * The text content of the model's response.
   */
  content: string;

  /**
   * Metrics information for the operation.
   */
  metrics: LDAIMetrics;

  /**
   * The raw response object from the provider, if available.
   */
  raw?: unknown;

  /**
   * Parsed structured output, if the provider returned structured data.
   */
  parsed?: Record<string, unknown>;
}

/**
 * The result returned by a managed model invocation (ManagedModel.run()).
 * Includes a promise for asynchronous judge evaluations.
 */
export interface ManagedResult {
  /**
   * The text content of the model's response.
   */
  content: string;

  /**
   * Summarized metrics for this invocation.
   */
  metrics: LDAIMetricSummary;

  /**
   * The raw response object from the provider, if available.
   */
  raw?: unknown;

  /**
   * Parsed structured output, if available.
   */
  parsed?: Record<string, unknown>;

  /**
   * Promise that resolves to the judge evaluation results.
   * This promise encapsulates both evaluation and tracking
   * (tracker.trackJudgeResult is called when it resolves).
   * Awaiting this promise guarantees both evaluation and tracking are complete.
   */
  evaluations: Promise<LDJudgeResult[]>;
}
