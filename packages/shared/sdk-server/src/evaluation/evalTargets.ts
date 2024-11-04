import { Context } from '@launchdarkly/js-sdk-common';

import { firstResult } from './collection';
import { Flag } from './data/Flag';
import { Target } from './data/Target';
import EvalResult from './EvalResult';
import Reasons from './Reasons';
import { getVariation } from './variations';

function evalTarget(flag: Flag, target: Target, context: Context): EvalResult | undefined {
  const contextKey = context.key(target.contextKind);
  if (contextKey !== undefined) {
    const found = target.values.indexOf(contextKey) >= 0;
    if (found) {
      return getVariation(flag, target.variation, Reasons.TargetMatch);
    }
  }

  return undefined;
}

/**
 * Evaluate the targets of the specified flag against the given context.
 * @param flag The flag to evaluate targets for.
 * @param context The context to evaluate those targets against.
 * @returns An evaluation result if there is a target match/error or undefined if there is not.
 *
 * @internal
 */
export default function evalTargets(flag: Flag, context: Context): EvalResult | undefined {
  if (!flag.contextTargets?.length) {
    // There are not context targets, so we are going to evaluate the user targets.
    return firstResult(flag.targets, (target) => evalTarget(flag, target, context));
  }

  return firstResult(flag.contextTargets, (target) => {
    if (!target.contextKind || target.contextKind === Context.UserKind) {
      // When a context target is for a user, then use a user target with the same variation.
      const userTarget = (flag.targets || []).find((ut) => ut.variation === target.variation);
      if (userTarget) {
        return evalTarget(flag, userTarget, context);
      }
      return undefined;
    }

    return evalTarget(flag, target, context);
  });
}
