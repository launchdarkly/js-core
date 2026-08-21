import { ErrorCode } from '@openfeature/server-sdk';
import type { FlagMetadata, ResolutionDetails } from '@openfeature/server-sdk';

import type { LDEvaluationDetail } from '@launchdarkly/js-sdk-common';

const VARIATION_INDEX_KEY = 'variationIndex';
const IN_EXPERIMENT_KEY = 'inExperiment';
const RULE_INDEX_KEY = 'ruleIndex';
const RULE_ID_KEY = 'ruleId';
const PREREQUISITE_KEY_KEY = 'prerequisiteKey';
const BIG_SEGMENTS_STATUS_KEY = 'bigSegmentsStatus';

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
 * Convert the LaunchDarkly specific parts of an evaluation into OpenFeature flag metadata.
 */
function translateFlagMetadata(result: LDEvaluationDetail): FlagMetadata {
  const metadata: FlagMetadata = {};
  if (result.variationIndex !== undefined && result.variationIndex !== null) {
    metadata[VARIATION_INDEX_KEY] = result.variationIndex;
  }
  if (result.reason.inExperiment) {
    metadata[IN_EXPERIMENT_KEY] = true;
  }
  if (result.reason.ruleIndex !== undefined) {
    metadata[RULE_INDEX_KEY] = result.reason.ruleIndex;
  }
  if (result.reason.ruleId !== undefined) {
    metadata[RULE_ID_KEY] = result.reason.ruleId;
  }
  if (result.reason.prerequisiteKey !== undefined) {
    metadata[PREREQUISITE_KEY_KEY] = result.reason.prerequisiteKey;
  }
  if (result.reason.bigSegmentsStatus !== undefined) {
    metadata[BIG_SEGMENTS_STATUS_KEY] = result.reason.bigSegmentsStatus;
  }
  return metadata;
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
    flagMetadata: translateFlagMetadata(result),
  };

  if (result.reason.kind === 'ERROR') {
    resolution.errorCode = translateErrorKind(result.reason.errorKind);
  }
  return resolution;
}
