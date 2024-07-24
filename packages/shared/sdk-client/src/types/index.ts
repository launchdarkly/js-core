import { LDEvaluationReason, LDFlagValue } from '@launchdarkly/js-sdk-common';

export interface LDEvaluationResult {
  version: number;
  flagVersion: number;
  value: LDFlagValue;
  variation: number;
  trackEvents: boolean;
  trackReason?: boolean;
  reason?: LDEvaluationReason;
  debugEventsUntilDate?: number;
  deleted?: boolean;
}

export interface PatchFlag extends LDEvaluationResult {
  key: string;
}

export type DeleteFlag = Pick<PatchFlag, 'key' | 'version'>;

export type LDEvaluationResultsMap = Map<string, LDEvaluationResult>
