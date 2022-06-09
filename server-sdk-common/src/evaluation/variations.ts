import { AttributeReference, Context, TypeValidators } from '@launchdarkly/js-sdk-common';
import { LDEvaluationReason } from '../api';
import Bucketer from './Bucketer';
import { Flag } from './data/Flag';
import { VariationOrRollout } from './data/VariationOrRollout';
import ErrorKinds from './ErrorKinds';
import EvalResult from './EvalResult';

export const KEY_ATTR_REF = new AttributeReference('key');

/**
 * Attempt to get an evaluation result for the specific variation/flag combination.
 * @param flag The flag to get a variation from.
 * @param index The index of the flag.
 * @param reason The initial evaluation reason. If there is a valid variation, then this reason
 * will be returned in the EvalResult.
 * @returns An evaluation result containing the successful evaluation, or an error if there is
 * a problem accessing the variation.
 *
 * @internal
 */
export function getVariation(flag: Flag, index: number, reason: LDEvaluationReason): EvalResult {
  if (TypeValidators.Number.is(index) && index >= 0 && index < flag.variations.length) {
    return EvalResult.ForSuccess(flag.variations[index], reason, index);
  }
  return EvalResult.ForError(ErrorKinds.MalformedFlag, 'Invalid variation index in flag');
}

/**
 * Attempt to get an off result for the specified flag.
 * @param flag The flag to get the off variation for.
 * @param reason The initial reason for the evaluation result.
 * @returns A successful evaluation result, or an error result if there is a problem accessing
 * the off variation. Flags which do not have an off variation specified will get a `null` flag
 * value with an `undefined` variation.
 *
 * @internal
 */
export function getOffVariation(flag: Flag, reason: LDEvaluationReason): EvalResult {
  if (!TypeValidators.Number.is(flag.offVariation)) {
    return EvalResult.ForSuccess(null, reason);
  }
  return getVariation(flag, flag.offVariation, reason);
}

export function variationForContext(
  varOrRollout: VariationOrRollout,
  context: Context,
  flag: Flag,
  reason: LDEvaluationReason,
  bucketer: Bucketer,
) {
  if (varOrRollout === undefined) {
    // By spec this field should be defined, but better to be overly cautious.
    return EvalResult.ForError(ErrorKinds.MalformedFlag, 'Fallthrough variation undefined');
  }

  if (varOrRollout.variation !== undefined) { // 0 would be false.
    return getVariation(flag, varOrRollout.variation, reason);
  }

  if (varOrRollout.rollout) {
    const { rollout } = varOrRollout;
    const { variations } = rollout;
    const isExperiment = rollout.kind === 'experiment';

    if (variations && variations.length) {
      const bucketBy = (isExperiment ? undefined
        : rollout.bucketByAttributeReference) ?? KEY_ATTR_REF;

      if (!bucketBy.isValid) {
        return EvalResult.ForError(
          ErrorKinds.MalformedFlag,
          'Invalid attribute reference for bucketBy in rollout',
        );
      }

      const bucket = bucketer.bucket(
        context,
        flag.key,
        bucketBy,
        flag.salt || '',
        isExperiment,
        rollout.contextKind,
        rollout.seed,
      );

      const updatedReason = { ...reason };
      updatedReason.inExperiment = isExperiment || undefined;

      let sum = 0;
      for (let i = 0; i < variations.length; i += 1) {
        const variate = variations[i];
        sum += variate.weight / 100000.0;
        if (bucket < sum) {
          return getVariation(flag, variate.variation, updatedReason);
        }
      }

      // The context's bucket value was greater than or equal to the end of
      // the last bucket. This could happen due to a rounding error, or due to
      // the fact that we are scaling to 100000 rather than 99999, or the flag
      // data could contain buckets that don't actually add up to 100000.
      // Rather than returning an error in this case (or changing the scaling,
      // which would potentially change the results for *all* users), we will
      // simply put the context in the last bucket.
      const lastVariate = variations[variations.length - 1];
      return getVariation(flag, lastVariate.variation, updatedReason);
    }
  }
  return EvalResult.ForError(ErrorKinds.MalformedFlag, 'Variation/rollout object with no variation or rollout');
}
