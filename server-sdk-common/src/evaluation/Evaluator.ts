/* eslint-disable max-classes-per-file */
import { Context } from '@launchdarkly/js-sdk-common';
import { Flag } from './data/Flag';
import EvalResult from './EvalResult';
import { getBucketBy, getOffVariation, variationForContext } from './variations';
import { Queries } from './Queries';
import Reasons from './Reasons';
import ErrorKinds from './ErrorKinds';
import evalTargets from './evalTargets';
import { allSeriesAsync, firstSeriesAsync } from './collection';
import { FlagRule } from './data/FlagRule';
import Bucketer from './Bucketer';
import { Platform } from '../platform';
import matchClause from './matchClause';
import { Segment } from './data/Segment';
import matchSegmentTargets from './matchSegmentTargets';
import { SegmentRule } from './data/SegmentRule';
import { Clause } from './data/Clause';

class EvalState {
  // events
  // bigSegmentsStatus
}

type Match = { error: false, isMatch: boolean, evalResult: undefined };
type Error = { error: true, evalResult: EvalResult };
type MatchOrError = Match | Error;

function tagMatch(val: boolean): Match {
  return { error: false, isMatch: val, evalResult: undefined };
}

function tagError(val: EvalResult): Error {
  return { error: true, evalResult: val };
}

/**
 * @internal
 */
export default class Evaluator {
  private queries: Queries;

  private bucketer: Bucketer;

  constructor(platform: Platform, queries: Queries) {
    this.queries = queries;
    this.bucketer = new Bucketer(platform.crypto);
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

    const ruleRes = await this.evaluateRules(flag, context, state);
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

  /**
   * Evaluate the rules for a flag and return an {@link EvalResult} if there is
   * a match or error.
   * @param flag The flag to evaluate rules for.
   * @param context The context to evaluate the rules against.
   * @param state The current evaluation state.
   * @returns
   */
  private async evaluateRules(
    flag: Flag,
    context: Context,
    state: EvalState,
  ): Promise<EvalResult | undefined> {
    let ruleResult: EvalResult | undefined;

    await firstSeriesAsync(flag.rules, async (rule, ruleIndex) => {
      ruleResult = await this.ruleMatchContext(flag, rule, ruleIndex, context, state, []);
      return !!ruleResult;
    });

    return ruleResult;
  }

  private async clauseMatchContext(
    clause: Clause,
    context: Context,
    segmentsVisited: string[],
    state: EvalState,
  ): Promise<MatchOrError> {
    let errorResult: EvalResult | undefined;
    if (!clause.attributeReference.isValid) {
      return tagError(EvalResult.ForError(ErrorKinds.MalformedFlag, 'Invalid attribute reference in clause'));
    }
    if (clause.op === 'segmentMatch') {
      firstSeriesAsync(clause.values, (async (value) => {
        const segment = await this.queries.getSegment(value);
        if (segment) {
          if (segmentsVisited.includes(segment.key)) {
            errorResult = EvalResult.ForError(ErrorKinds.MalformedFlag, `Segment rule referencing segment ${segment.key} caused a circular reference. `
              + 'This is probably a temporary condition due to an incomplete update');
            // There was an error, so stop checking further segments.
            return true;
          }

          const newVisited = [...segmentsVisited, segment?.key];
          const res = await this.segmentMatchContext(segment, context, state, newVisited);
          if (res.error) {
            errorResult = res.evalResult;
          }
          return res.error || res.isMatch;
        }

        return false;
      }));
      // TODO: Implement.
      return tagMatch(false);
    }
    if (errorResult) {
      return tagError(errorResult);
    }
    return tagMatch(matchClause(clause, context));
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
  private async ruleMatchContext(
    flag: Flag,
    rule: FlagRule,
    ruleIndex: number,
    context: Context,
    // TODO: Will be used once big segments are implemented.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    state: EvalState,
    segmentsVisited: string[],
  ): Promise<EvalResult | undefined> {
    if (!rule.clauses) {
      return undefined;
    }
    let errorResult: EvalResult | undefined;
    const match = await allSeriesAsync(rule.clauses, async (clause) => {
      const res = await this.clauseMatchContext(clause, context, segmentsVisited, state);
      errorResult = res.evalResult;
      return res.error || res.isMatch;
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

  async segmentRuleMatchContext(
    rule: SegmentRule,
    context: Context,
    state: EvalState,
    segmentsVisited: string[],
    salt?: string,
  ): Promise<MatchOrError> {
    let errorResult: EvalResult | undefined;
    const match = await allSeriesAsync(rule.clauses, async (clause) => {
      const res = await this.clauseMatchContext(clause, context, segmentsVisited, state);
      errorResult = res.evalResult;
      return res.error || res.isMatch;
    });

    if (errorResult) {
      return tagError(errorResult);
    }

    if (match) {
      if (!rule.weight) {
        return tagMatch(match);
      }
      const bucketBy = getBucketBy(false, rule.bucketByAttributeReference);
      if (!bucketBy.isValid) {
        return tagError(EvalResult.ForError(ErrorKinds.MalformedFlag, 'Invalid attribute reference in clause'));
      }
      const bucket = this.bucketer.bucket(context, 'TODO: Key', bucketBy, salt || '', false, rule.rolloutContextKind);
      return tagMatch(bucket < rule.weight);
    }

    return tagMatch(false);
  }

  // eslint-disable-next-line class-methods-use-this
  async simpleSegmentMatchContext(
    segment: Segment,
    context: Context,
    state: EvalState,
    segmentsVisited: string[],
  ): Promise<MatchOrError> {
    const includeExclude = matchSegmentTargets(segment, context);
    if (includeExclude) {
      return tagMatch(true);
    }

    let evalResult: EvalResult | undefined;
    const matched = await allSeriesAsync(segment.rules, async (rule) => {
      const res = await this.segmentRuleMatchContext(
        rule,
        context,
        state,
        segmentsVisited,
        segment.salt,
      );
      evalResult = res.evalResult;
      return res.error || res.isMatch;
    });
    if (evalResult) {
      return tagError(evalResult);
    }

    return tagMatch(matched);
  }

  async segmentMatchContext(
    segment: Segment,
    context: Context,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    state: EvalState,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    segmentsVisited: string[],
  ): Promise<MatchOrError> {
    if (!segment.unbounded) {
      const res = await this.simpleSegmentMatchContext(segment, context, state, segmentsVisited);
      if (res) {
        return res;
      }
    }

    // TODO: Big segments.
    return tagMatch(false);
  }
}
