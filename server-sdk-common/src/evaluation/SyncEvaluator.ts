/* eslint-disable max-classes-per-file */
import { Context } from '@launchdarkly/js-sdk-common';
import AttributeReference from '@launchdarkly/js-sdk-common/dist/AttributeReference';
import { Flag } from './data/Flag';
import EvalResult from './EvalResult';
import { getOffVariation, variationForContext } from './variations';
import {  SyncQueries } from './Queries';
import Reasons from './Reasons';
import ErrorKinds from './ErrorKinds';
import evalTargets from './evalTargets';
import { allSeries, allSeriesAsync, firstSeries} from './collection';
import { FlagRule } from './data/FlagRule';
import Bucketer from './Bucketer';
import { Platform } from '../platform';
import matchClause from './matchClause';

class EvalState {
  // events
  // bigSegmentsStatus
}

/**
 * @internal
 */
export default class SyncEvaluator {
  private queries: SyncQueries;

  private bucketer: Bucketer;

  constructor(platform: Platform, queries: SyncQueries) {
    this.queries = queries;
    this.bucketer = new Bucketer(platform.crypto);
  }

  evaluate(flag: Flag, context: Context): EvalResult {
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
  private evaluateInternal(
    flag: Flag,
    context: Context,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    state: EvalState,
    visitedFlags: string[],
  ): EvalResult {
    if (!flag.on) {
      return getOffVariation(flag, Reasons.Off);
    }

    const prereqResult = this.checkPrerequisites(
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

    const ruleRes = this.evaluateRules(flag, context, state);
    if (ruleRes) {
      return ruleRes;
    }

    return variationForContext(
      flag.fallthrough,
      context,
      flag,
      Reasons.Fallthrough,
      this.bucketer,
    );
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
  private checkPrerequisites(
    flag: Flag,
    context: Context,
    state: EvalState,
    visitedFlags: string[],
  ): EvalResult | undefined {
    let prereqResult: EvalResult | undefined;

    if (!flag.prerequisites || !flag.prerequisites.length) {
      return undefined;
    }

    // On any error conditions the prereq result will be set, so we do not need
    // the result of the series evaluation.
    allSeries(flag.prerequisites, (prereq) => {
      if (visitedFlags.indexOf(prereq.key) !== -1) {
        prereqResult = EvalResult.ForError(
          ErrorKinds.MalformedFlag,
          `Prerequisite of ${flag.key} causing a circular reference.`
          + ' This is probably a temporary condition due to an incomplete update.',
        );
        return false;
      }
      const updatedVisitedFlags = [...visitedFlags, prereq.key];
      const prereqFlag = this.queries.getFlag(prereq.key);

      if (!prereqFlag) {
        prereqResult = EvalResult.ForPrerequisiteFailed(prereq.key);
        return false;
      }

      const evalResult = this.evaluateInternal(
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

  /**
   * Evaluate the rules for a flag and return an {@link EvalResult} if there is
   * a match or error.
   * @param flag The flag to evaluate rules for.
   * @param context The context to evaluate the rules against.
   * @param state The current evaluation state.
   * @returns
   */
  private evaluateRules(
    flag: Flag,
    context: Context,
    state: EvalState,
  ): EvalResult | undefined {
    let ruleResult: EvalResult | undefined;

    firstSeries(flag.rules, (rule, ruleIndex) => {
      ruleResult = this.ruleMatchContext(flag, rule, ruleIndex, context, state);
      return !!ruleResult;
    });

    return ruleResult;
  }

  /**
   * Evaluate a flag rule against the given context.
   * @param flag The flag the rule is part of.
   * @param rule The rule to match.
   * @param rule The index of the rule.
   * @param context The context to match the rule against.
   * @returns An {@link EvalResult} or `undefined` if there are no matches or errors.
   */
  // TODO: Should be used once we have big segment support.
  // eslint-disable-next-line class-methods-use-this
  private ruleMatchContext(
    flag: Flag,
    rule: FlagRule,
    ruleIndex: number,
    context: Context,
    // TODO: Will be used once big segments are implemented.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    state: EvalState,
  ): EvalResult | undefined {
    if (!rule.clauses) {
      return undefined;
    }
    let errorResult: EvalResult | undefined;
    const match = allSeries(rule.clauses, (clause) => {
      if (!clause.attributeReference.isValid) {
        errorResult = EvalResult.ForError(ErrorKinds.MalformedFlag, 'Invalid attribute reference in clause');
        return false;
      }
      if (clause.op === 'segmentMatch') {
        // TODO: Implement.
        return false;
      }
      return matchClause(clause, context);
    });

    if (errorResult) {
      return errorResult;
    }

    if (match) {
      return variationForContext(
        rule,
        context,
        flag,
        Reasons.ruleMatch(rule.id, ruleIndex),
        this.bucketer,
      );
    }
    return undefined;
  }
}
