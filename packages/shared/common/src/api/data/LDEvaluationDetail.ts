import { LDEvaluationReason } from './LDEvaluationReason';
import { LDFlagValue } from './LDFlagValue';

/**
 * An object that combines the result of a feature flag evaluation with information about
 * how it was calculated.
 *
 * This is the result of calling `LDClient.variationDetail`.
 *
 * For more information, see the [SDK reference guide](https://docs.launchdarkly.com/sdk/features/evaluation-reasons#nodejs-server-side).
 */
export interface LDEvaluationDetail {
  /**
   * The result of the flag evaluation. This will be either one of the flag's variations or
   * the default value that was passed to `LDClient.variationDetail`.
   */
  value: LDFlagValue;

  /**
   * The index of the returned value within the flag's list of variations, e.g. 0 for the
   * first variation-- or `null` if the default value was returned.
   */
  variationIndex?: number | null;

  /**
   * An object describing the main factor that influenced the flag evaluation value.
   */
  reason: LDEvaluationReason;
}

export interface LDEvaluationDetailTyped<TFlag> {
  /**
   * The result of the flag evaluation. This will be either one of the flag's variations or
   * the default value that was passed to `LDClient.variationDetail`.
   */
  value: TFlag;

  /**
   * The index of the returned value within the flag's list of variations, e.g. 0 for the
   * first variation-- or `null` if the default value was returned.
   */
  variationIndex?: number | null;

  /**
   * An object describing the main factor that influenced the flag evaluation value.
   */
  reason: LDEvaluationReason;
}
