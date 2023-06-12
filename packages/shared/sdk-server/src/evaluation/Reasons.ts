import { LDEvaluationReason } from '@launchdarkly/js-sdk-common';

/**
 * A set of static evaluation reasons and methods for creating specific reason instances.
 *
 * @internal
 */
export default class Reasons {
  static readonly Fallthrough: LDEvaluationReason = { kind: 'FALLTHROUGH' };

  static readonly Off: LDEvaluationReason = { kind: 'OFF' };

  static prerequisiteFailed(prerequisiteKey: string): LDEvaluationReason {
    return { kind: 'PREREQUISITE_FAILED', prerequisiteKey };
  }

  static ruleMatch(ruleId: string, ruleIndex: number): LDEvaluationReason {
    return { kind: 'RULE_MATCH', ruleId, ruleIndex };
  }

  static readonly TargetMatch: LDEvaluationReason = { kind: 'TARGET_MATCH' };
}

Object.freeze(Reasons);
Object.freeze(Reasons.Fallthrough);
Object.freeze(Reasons.Off);
Object.freeze(Reasons.TargetMatch);
