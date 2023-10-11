import { LDEvaluationReason } from '../../api';

/**
 * A set of static evaluation reasons and methods for creating specific reason instances.
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
