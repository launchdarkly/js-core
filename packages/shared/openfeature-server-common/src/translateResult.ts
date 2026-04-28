import { ErrorCode } from '@openfeature/server-sdk';
import type { ResolutionDetails } from '@openfeature/server-sdk';

import type { LDEvaluationDetail } from '@launchdarkly/js-sdk-common';

/**
 * Convert an `errorKind` into an OpenFeature `errorCode`.
 */
function translateErrorKind(errorKind: string | undefined): ErrorCode {
  switch (errorKind) {
    case 'CLIENT_NOT_READY':
      return ErrorCode.PROVIDER_NOT_READY;
    case 'MALFORMED_FLAG':
      return ErrorCode.PARSE_ERROR;
    case 'FLAG_NOT_FOUND':
      return ErrorCode.FLAG_NOT_FOUND;
    case 'USER_NOT_SPECIFIED':
      return ErrorCode.TARGETING_KEY_MISSING;
    default:
      return ErrorCode.GENERAL;
  }
}

/**
 * Translate an {@link LDEvaluationDetail} to a {@link ResolutionDetails}.
 *
 */
export function translateResult<T>(result: LDEvaluationDetail): ResolutionDetails<T> {
  const resolution: ResolutionDetails<T> = {
    value: result.value,
    variant: result.variationIndex?.toString(),
    reason: result.reason.kind,
  };

  if (result.reason.kind === 'ERROR') {
    resolution.errorCode = translateErrorKind(result.reason.errorKind);
  }
  return resolution;
}
