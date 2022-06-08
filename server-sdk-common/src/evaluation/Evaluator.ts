/* eslint-disable max-classes-per-file */
import { Context } from '@launchdarkly/js-sdk-common';
import { Flag } from './data/Flag';
import EvalResult from './EvalResult';
import { getOffVariation } from './variations';
import { Queries } from './Queries';
import Reasons from './Reasons';
import ErrorKinds from './ErrorKinds';
import evalTargets from './evalTargets';
import { allSeriesAsync } from './collection';
import Operators from './Operations';
import { Clause } from './data/Clause';

class EvalState {
  // events
  // bigSegmentsStatus
}

function maybeNegate(clause: Clause, value: boolean): boolean {
  if (clause.negate) {
    return !value;
  }
  return value;
}

function matchClause(clause: Clause, context:Context): boolean {
  const contextValue = context.valueForKind(clause.attributeReference, clause.contextKind);
  if (Array.isArray(contextValue)) {
    return maybeNegate(
      clause,
      contextValue.some(
        (value) => Operators.execute(clause.op, value, clause.values),
      ),
    );
  }
  return maybeNegate(
    clause,
    Operators.execute(clause.op, contextValue, clause.values),
  );
}

/**
 * @internal
 */
export default class Evaluator {
  private queries: Queries;

  constructor(queries: Queries) {
    this.queries = queries;
  }

  async evaluate(flag: Flag, context: Context): Promise<EvalResult> {
    const state = new EvalState();
    return this.evaluateInternal(flag, context, state, []);
  }

  /**
   * Evaluate the given flag against the given context. This internal method is entered
   * initially from the external evaluation method, but may be recursively executed during
   * prerequisite evaluations.
   * @param flag The flag to evaluate.
   * @param context The context to evaluate the flag against.
   * @param state The current evaluation state.
   * @param visitedFlags The flags that have been visited during this evaluation.
   * This is not part of the state, because it needs to be forked during prerequisite evaluations.
   */
  private async evaluateInternal(
    flag: Flag,
    context: Context,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    state: EvalState,
    visitedFlags: string[],
  ): Promise<EvalResult> {
    if (!flag.on) {
      return getOffVariation(flag, Reasons.Off);
    }

    const prereqResult = await this.checkPrerequisites(
      flag,
      context,
      state,
      visitedFlags,
    );
    // If there is a prereq result, then prereqs have failed, or there was
    // an error.
    if (prereqResult) {
      return prereqResult;
    }

    const targetRes = evalTargets(flag, context);
    if (targetRes) {
      return targetRes;
    }

    // TODO: For now this provides a default result during implementation.
    return EvalResult.ForError(ErrorKinds.FlagNotFound, 'Temporary');
  }

  /**
   * Evaluate the prerequisite flags for the given flag.
   * @param flag The flag to evaluate prerequisites for.
   * @param context The context to evaluate the prerequisites against.
   * @param state Used to accumulate prerequisite events.
   * @param visitedFlags Used to detect cycles in prerequisite evaluation.
   * @returns An {@link EvalResult} containing an error result or `undefined` if the prerequisites
   * are met.
   */
  private async checkPrerequisites(
    flag: Flag,
    context: Context,
    state: EvalState,
    visitedFlags: string[],
  ): Promise<EvalResult | undefined> {
    let prereqResult: EvalResult | undefined;

    if (!flag.prerequisites || !flag.prerequisites.length) {
      return undefined;
    }

    // On any error conditions the prereq result will be set, so we do not need
    // the result of the series evaluation.
    await allSeriesAsync(flag.prerequisites, async (prereq) => {
      if (visitedFlags.indexOf(prereq.key) !== -1) {
        prereqResult = EvalResult.ForError(
          ErrorKinds.MalformedFlag,
          `Prerequisite of ${flag.key} causing a circular reference.`
          + ' This is probably a temporary condition due to an incomplete update.',
        );
        return false;
      }
      const updatedVisitedFlags = [...visitedFlags, prereq.key];
      const prereqFlag = await this.queries.getFlag(prereq.key);

      if (!prereqFlag) {
        prereqResult = EvalResult.ForPrerequisiteFailed(prereq.key);
        return false;
      }

      const evalResult = await this.evaluateInternal(
        prereqFlag,
        context,
        state,
        updatedVisitedFlags,
      );
      // TODO: Add the prereq evaluation to the state events.

      if (evalResult.isError) {
        prereqResult = evalResult;
        return false;
      }

      if (evalResult.isOff || evalResult.detail.variationIndex !== prereq.variation) {
        prereqResult = EvalResult.ForPrerequisiteFailed(prereq.key);
        return false;
      }
      return true;
    });

    if (prereqResult) {
      return prereqResult;
    }

    // There were no prereqResults for errors or failed prerequisites.
    // So they have all passed.
    return undefined;
  }

  // /**
  //  * Evaluate a flag rule against the given context.
  //  * @param rule The rule to match.
  //  * @param context The context to match the rule against.
  //  * @returns An {@link EvalResult} or `undefined` if there are no matches or errors.
  //  */
  // private async ruleMatchContext(
  //   rule: FlagRule,
  //   context: Context,
  // ): Promise<EvalResult | undefined> {
  //   if (!rule.clauses) {
  //     return undefined;
  //   }
  //   const match = await allSeriesAsync(rule.clauses, async (clause) => {
  //     if (clause.op === 'segmentMatch') {
  //       const match = await allSeriesAsync(clause.values, async (value) => {

  //       });
  //       // TODO: Implement.
  //       return false;
  //     }
  //     return matchClause(clause, context);
  //   });
  // }
}
