import { LDEvaluationReason, LDFlagValue } from '../../api';
import ErrorKinds from './ErrorKinds';

export const createErrorEvaluationDetail = (errorKind: ErrorKinds, def?: LDFlagValue) => ({
  value: def ?? null,
  variationIndex: null,
  reason: { kind: 'ERROR', errorKind },
});

export const createSuccessEvaluationDetail = (
  value: LDFlagValue,
  variationIndex?: number,
  reason?: LDEvaluationReason,
) => ({
  value,
  variationIndex: variationIndex ?? null,
  reason: reason ?? null,
});
