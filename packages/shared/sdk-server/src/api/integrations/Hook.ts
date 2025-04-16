import { LDContext, LDEvaluationDetail } from '@launchdarkly/js-sdk-common';

/**
 * Contextual information provided to evaluation stages.
 */
export interface EvaluationSeriesContext {
  readonly flagKey: string;
  readonly context: LDContext;
  readonly defaultValue: unknown;
  readonly method: string;
  readonly environmentId?: string;
}

/**
 * Implementation specific hook data for evaluation stages.
 *
 * Hook implementations can use this to store data needed between stages.
 */
export interface EvaluationSeriesData {
  readonly [index: string]: unknown;
}

/**
 * Meta-data about a hook implementation.
 */
export interface HookMetadata {
  readonly name: string;
}

/**
 * Interface for extending SDK functionality via hooks.
 */
export interface Hook {
  /**
   * Get metadata about the hook implementation.
   */
  getMetadata(): HookMetadata;

  /**
   * The before method is called during the execution of a variation method
   * before the flag value has been determined. The method is executed synchronously.
   *
   * @param hookContext Contains information about the evaluation being performed. This is not
   *  mutable.
   * @param data A record associated with each stage of hook invocations. Each stage is called with
   * the data of the previous stage for a series. The input record should not be modified.
   * @returns Data to use when executing the next state of the hook in the evaluation series. It is
   * recommended to expand the previous input into the return. This helps ensure your stage remains
   * compatible moving forward as more stages are added.
   * ```js
   * return {...data, "my-new-field": /*my data/*}
   * ```
   */
  beforeEvaluation?(
    hookContext: EvaluationSeriesContext,
    data: EvaluationSeriesData,
  ): EvaluationSeriesData;

  /**
   * The after method is called during the execution of the variation method
   * after the flag value has been determined. The method is executed synchronously.
   *
   * @param hookContext Contains read-only information about the evaluation
   * being performed.
   * @param data A record associated with each stage of hook invocations. Each
   *  stage is called with the data of the previous stage for a series.
   * @param detail The result of the evaluation. This value should not be
   * modified.
   * @returns Data to use when executing the next state of the hook in the evaluation series. It is
   * recommended to expand the previous input into the return. This helps ensure your stage remains
   * compatible moving forward as more stages are added.
   * ```js
   * return {...data, "my-new-field": /*my data/*}
   * ```
   */
  afterEvaluation?(
    hookContext: EvaluationSeriesContext,
    data: EvaluationSeriesData,
    detail: LDEvaluationDetail,
  ): EvaluationSeriesData;
}
