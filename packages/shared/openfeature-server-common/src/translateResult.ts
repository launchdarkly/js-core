import { ErrorCode } from '@openfeature/server-sdk';
import type { FlagMetadata, ResolutionDetails } from '@openfeature/server-sdk';

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
 * The LaunchDarkly specific parts of an evaluation result, reported as OpenFeature flag metadata.
 *
 * Each entry is absent when it does not apply to the evaluation.
 */
export type LDFlagMetadata = FlagMetadata & {
  /**
   * The index of the returned variation. Absent for default values.
   */
  variationIndex?: number;
  /**
   * Present, and `true`, when the evaluation was part of an experiment.
   */
  inExperiment?: boolean;
  /**
   * The index of the rule that matched.
   */
  ruleIndex?: number;
  /**
   * The identifier of the rule that matched.
   */
  ruleId?: string;
  /**
   * The key of the prerequisite flag that failed.
   */
  prerequisiteKey?: string;
  /**
   * The status of the Big Segments query made during the evaluation.
   */
  bigSegmentsStatus?: string;
};

/**
 * Convert the LaunchDarkly specific parts of an evaluation into OpenFeature flag metadata.
 */
function translateFlagMetadata(result: LDEvaluationDetail): LDFlagMetadata {
  const metadata: LDFlagMetadata = {};
  if (result.variationIndex !== undefined && result.variationIndex !== null) {
    metadata.variationIndex = result.variationIndex;
  }
  if (result.reason.inExperiment) {
    metadata.inExperiment = true;
  }
  if (result.reason.ruleIndex !== undefined) {
    metadata.ruleIndex = result.reason.ruleIndex;
  }
  if (result.reason.ruleId !== undefined) {
    metadata.ruleId = result.reason.ruleId;
  }
  if (result.reason.prerequisiteKey !== undefined) {
    metadata.prerequisiteKey = result.reason.prerequisiteKey;
  }
  if (result.reason.bigSegmentsStatus !== undefined) {
    metadata.bigSegmentsStatus = result.reason.bigSegmentsStatus;
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
