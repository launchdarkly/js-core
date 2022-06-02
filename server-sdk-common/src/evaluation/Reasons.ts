import { LDEvaluationReason } from '../api';

export default class Reasons {
  static readonly Fallthrough: LDEvaluationReason = { kind: 'FALLTHROUGH' };

  static readonly Off: LDEvaluationReason = { kind: 'OFF' };

  static prerequisiteFailed(prerequisiteKey: string): LDEvaluationReason {
    return { kind: 'PREREQUISITE_FAILED', prerequisiteKey };
  }

  static ruleMatch(ruleId: string): LDEvaluationReason {
    return { kind: 'RULE_MATCH', ruleId };
  }

  static readonly TargetMatch: LDEvaluationReason = { kind: 'TARGET_MATCH' };
}
