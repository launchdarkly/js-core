import { LDEvaluationDetailTyped as CommonLDEvaluationDetailTyped, LDEvaluationReason, } from '@launchdarkly/js-client-sdk-common';

/**
 * An object that combines the result of a feature flag evaluation with information about
 * how it was calculated.
 *
 * This is the result of calling detailed variation methods.
 *
 * @remarks
 * We will be deprecating this type in favor of {@link CommonLDEvaluationDetailTyped} in the
 * next major version.
 */
export type LDEvaluationDetailTyped<TFlag> = Omit<CommonLDEvaluationDetailTyped<TFlag>, 'reason'> & {
  /**
   * An optional object describing the main factor that influenced the flag evaluation value.
   */
  reason: LDEvaluationReason | null;
};