import { LDEvaluationReason, LDFlagValue } from '@launchdarkly/js-sdk-common';

export interface Flag {
  version: number;
  flagVersion?: number;
  value: LDFlagValue;
  variation?: number;
  trackEvents?: boolean;
  trackReason?: boolean;
  reason?: LDEvaluationReason;
  debugEventsUntilDate?: number;
  deleted?: boolean;
  prerequisites?: string[];
}

export interface PatchFlag extends Flag {
  key: string;
}

export type DeleteFlag = Pick<PatchFlag, 'key' | 'version'>;

export type Flags = {
  [k: string]: Flag;
};
