import { internal, LDEvaluationReason, LDFlagValue } from '@launchdarkly/js-sdk-common';

import { LDEvaluationDetail } from '../api';

export function createErrorEvaluationDetail(
  errorKind: internal.ErrorKinds,
  def?: LDFlagValue,
): LDEvaluationDetail {
  return {
    value: def ?? null,
    variationIndex: null,
    reason: { kind: 'ERROR', errorKind },
  };
}

export function createSuccessEvaluationDetail(
  value: LDFlagValue,
  variationIndex?: number,
  reason?: LDEvaluationReason,
  prerequisites?: string[],
): LDEvaluationDetail {
  return {
    value,
    variationIndex: variationIndex ?? null,
    reason: reason ?? null,
    prerequisites,
  };
}
