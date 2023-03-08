import { LDEvaluationReason } from '@launchdarkly/js-sdk-common';
import { Flag } from '../evaluation/data/Flag';

/**
 * @internal
 */
export default function isExperiment(flag: Flag, reason?: LDEvaluationReason): boolean {
  if (reason) {
    // If the reason says we're in an experiment, we are. Otherwise, apply
    // the legacy rule exclusion logic.
    if (reason.inExperiment) {
      return true;
    }
    switch (reason.kind) {
      case 'RULE_MATCH': {
        const index = reason.ruleIndex;
        if (index !== undefined) {
          const rules = flag.rules || [];
          return index >= 0 && index < rules.length && !!rules[index].trackEvents;
        }
        break;
      }
      case 'FALLTHROUGH':
        return !!flag.trackEventsFallthrough;
      default:
      // No action needed.
    }
  }
  return false;
}
