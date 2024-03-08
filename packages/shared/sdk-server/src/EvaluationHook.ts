import { LDContext, LDEvaluationDetail } from '@launchdarkly/js-sdk-common';

/**
 * Contextual information provided to evaluation hooks.
 */
export interface EvaluationHookContext {
  readonly key: string;
  readonly context: LDContext;
  readonly defaultValue: unknown;
}

export interface EvaluationHookData {
  [index: string]: unknown;
}

export interface EvaluationHookMetadata {
  readonly name: string;
}

export interface EvaluationHook {
  getMetadata(): EvaluationHookMetadata;

  /**
   * The before method is called during the execution of a variation method
   * before the flag value has been determined.
   *
   * @param hookContext Contains information about the evaluation being
   * performed. This is not mutable.
   * @param data A mutable record associated with each stage of hook
   * invocations. The same instance will be passed to each stage for a given
   * hook.
   */
  before?(hookContext: EvaluationHookContext, data: EvaluationHookData): void;

  /**
   * The after method is called during the execution of the variation method
   * after the flag value has been determined.
   *
   * @param hookContext Contains read-only information about the evaluation
   * being performed.
   * @param data A mutable record associated with each stage of hook
   * invocations. The same instance will be passed to each stage for a given
   * hook.
   * @param detail The result of the evaluation. This value should not be
   * modified.
   */
  after?(
    hookContext: EvaluationHookContext,
    data: EvaluationHookData,
    detail: LDEvaluationDetail,
  ): void;
}
