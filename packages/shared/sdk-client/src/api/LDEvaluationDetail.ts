import {
  LDEvaluationDetail as CommonDetail,
  LDEvaluationDetailTyped as CommonDetailTyped,
  LDEvaluationReason,
} from '@launchdarkly/js-sdk-common';

// Implementation note: In client-side SDKs the reason is optional. The common type, which is also
// used by server SDKs, has a required reason. This file contains a client specific
// LDEvaluationDetail which has an optional reason.

/**
 * An object that combines the result of a feature flag evaluation with information about
 * how it was calculated.
 *
 * This is the result of calling `LDClient.variationDetail`.
 */
export type LDEvaluationDetail = Omit<CommonDetail, 'reason'> & {
  /**
   * An optional object describing the main factor that influenced the flag evaluation value.
   */
  reason?: LDEvaluationReason | null;
};

/**
 * An object that combines the result of a feature flag evaluation with information about
 * how it was calculated.
 *
 * This is the result of calling detailed variation methods.
 */
export type LDEvaluationDetailTyped<TFlag> = Omit<CommonDetailTyped<TFlag>, 'reason'> & {
  /**
   * An optional object describing the main factor that influenced the flag evaluation value.
   */
  reason?: LDEvaluationReason | null;
};
