import { TypeValidators } from '@launchdarkly/js-sdk-common';
import { LDEvaluationReason } from '../api';
import { Flag } from './data/Flag';
import ErrorKinds from './ErrorKinds';
import EvalResult from './EvalResult';

export function getVariation(flag: Flag, index: number, reason: LDEvaluationReason): EvalResult {
  if (TypeValidators.Number.is(index) && index >= 0 && index <= flag.variations.length) {
    return EvalResult.ForSuccess(flag.variations[index], reason, index);
  }
  return EvalResult.ForError(ErrorKinds.MalformedFlag, 'Invalid variation index in flag');
}

export function getOffVariation(flag: Flag, reason: LDEvaluationReason): EvalResult {
  if (!TypeValidators.Number.is(flag.offVariation)) {
    return EvalResult.ForSuccess(null, reason);
  }
  return getVariation(flag, flag.offVariation, reason);
}
