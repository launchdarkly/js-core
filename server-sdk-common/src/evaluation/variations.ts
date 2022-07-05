import { TypeValidators } from '@launchdarkly/js-sdk-common';
import { LDEvaluationReason } from '../api';
import { Flag } from './data/Flag';
import ErrorKinds from './ErrorKinds';
import EvalResult from './EvalResult';

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
    return EvalResult.forSuccess(flag.variations[index], reason, index);
  }
  return EvalResult.forError(ErrorKinds.MalformedFlag, 'Invalid variation index in flag');
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
    return EvalResult.forSuccess(null, reason);
  }
  return getVariation(flag, flag.offVariation, reason);
}
