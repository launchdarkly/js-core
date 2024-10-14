import { LDEvaluationReason } from './LDEvaluationReason';
import { LDFlagValue } from './LDFlagValue';

// TODO: On major version change "variationIndex" to only be optional and not nullable.

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

  /**
   * An optional ordered list of prerequisite flag keys evaluated while determining the flags value.
   * This will only include the direct prerequisites of the flag.
   */
  prerequisites?: string[];
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

  /**
   * An ordered list of prerequisite flag keys evaluated while determining the flags value.
   */
  prerequisites?: string[];
}
