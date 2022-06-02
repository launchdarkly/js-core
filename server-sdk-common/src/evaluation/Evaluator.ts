/* eslint-disable class-methods-use-this */
/* eslint-disable max-classes-per-file */
import { Context } from '@launchdarkly/js-sdk-common';
import { Flag } from './data/Flag';
import EvalResult from './EvalResult';
import { getOffVariation } from './variations';
import { Queries } from './Queries';
import Reasons from './Reasons';
import ErrorKinds from './ErrorKinds';
import evalTargets from './evalTargets';

class EvalState {
  // events
  // bigSegmentsStatus
}

export default class Evaluator {
  private queries: Queries;

  constructor(queries: Queries) {
    this.queries = queries;
  }

  async evaluate(flag: Flag, context: Context): Promise<EvalResult> {
    const state = new EvalState();
    return this.evaluateInternal(flag, context, state);
  }

  private async evaluateInternal(
    flag: Flag,
    context: Context,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    state: EvalState,
  ): Promise<EvalResult> {
    if (!flag.on) {
      return getOffVariation(flag, Reasons.Off);
    }

    // TODO: Add prerequisite evaluation.

    const targetRes = evalTargets(flag, context);
    if (targetRes) {
      return targetRes;
    }

    // TODO: For now this provides a default result during implementation.
    return EvalResult.ForError(ErrorKinds.FlagNotFound, 'Temporary');
  }

  // private async ruleMatchContext(
  //   rule: FlagRule,
  //   context: Context,
  // ): Promise<EvalResult | undefined> {
  //   if (!rule.clauses) {
  //     return undefined;
  //   }
  //   const match = await allSeriesAsync(rule.clauses, async (clause) => {
  //     if (clause.op === 'segmentMatch') {
  //       // TODO: Implement.
  //       return false;
  //     }
  //   });
  // }
}
