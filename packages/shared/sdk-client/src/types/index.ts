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

/**
 * Represents a pre-evaluated flag result for a specific context, as delivered
 * by the FDv2 protocol via `put-object` events with `kind: 'flag_eval'`.
 *
 * This is the shape of the `object` field in a `put-object` event with
 * `kind: 'flag_eval'`. It contains all the same fields as {@link Flag} except
 * `version`, which is provided separately in the `put-object` envelope.
 *
 * There is no aggregate payload-level version field; per-flag versioning is
 * tracked via `flagVersion`, and aggregate payload state is tracked via the
 * payload selector.
 */
export type FlagEvaluationResult = Omit<Flag, 'version'> & {
  samplingRatio?: number;
};

export type Flags = {
  [k: string]: Flag;
};
