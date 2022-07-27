/* eslint-disable class-methods-use-this */
/* eslint-disable max-classes-per-file */
import { Context } from '@launchdarkly/js-sdk-common';
import { Flag } from './data/Flag';
import EvalResult from './EvalResult';
import { getBucketBy, getOffVariation, getVariation } from './variations';
import { Queries } from './Queries';
import Reasons from './Reasons';
import ErrorKinds from './ErrorKinds';
import evalTargets from './evalTargets';
import { allSeriesAsync, firstSeriesAsync } from './collection';
import { FlagRule } from './data/FlagRule';
import Bucketer from './Bucketer';
import { Platform } from '../platform';
import { VariationOrRollout } from './data/VariationOrRollout';
import { LDEvaluationReason } from '../api';
import matchClauseWithoutSegmentOperations from './matchClause';
import { Segment } from './data/Segment';
import matchSegmentTargets from './matchSegmentTargets';
import { SegmentRule } from './data/SegmentRule';
import { Clause } from './data/Clause';

class EvalState {
  // events
  // bigSegmentsStatus
}

class Match {
  public readonly error = false;

  public readonly result?: EvalResult;

  constructor(public readonly isMatch: boolean) { }
}

class MatchError {
  public readonly error = true;

  public readonly isMatch = false;

  constructor(public readonly result: EvalResult) { }
}

/**
 * MatchOrError effectively creates a discriminated union for the segment
 * matching process. Allowing encoding a true/false match result, or an
 * error condition represented as an EvalResult.
 */
type MatchOrError = Match | MatchError;

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

    return this.variationForContext(
      flag.fallthrough,
      context,
      flag,
      Reasons.Fallthrough,
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
        prereqResult = EvalResult.forError(
          ErrorKinds.MalformedFlag,
          `Prerequisite of ${flag.key} causing a circular reference.`
          + ' This is probably a temporary condition due to an incomplete update.',
        );
        return false;
      }
      const updatedVisitedFlags = [...visitedFlags, prereq.key];
      const prereqFlag = await this.queries.getFlag(prereq.key);

      if (!prereqFlag) {
        prereqResult = getOffVariation(flag, Reasons.prerequisiteFailed(prereq.key));
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
        prereqResult = getOffVariation(flag, Reasons.prerequisiteFailed(prereq.key));
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
    if (clause.op === 'segmentMatch') {
      const match = await firstSeriesAsync(clause.values, (async (value) => {
        const segment = await this.queries.getSegment(value);
        if (segment) {
          if (segmentsVisited.includes(segment.key)) {
            errorResult = EvalResult.forError(ErrorKinds.MalformedFlag, `Segment rule referencing segment ${segment.key} caused a circular reference. `
              + 'This is probably a temporary condition due to an incomplete update');
            // There was an error, so stop checking further segments.
            return true;
          }

          const newVisited = [...segmentsVisited, segment?.key];
          const res = await this.segmentMatchContext(segment, context, state, newVisited);
          if (res.error) {
            errorResult = res.result;
          }
          return res.error || res.isMatch;
        }

        return false;
      }));

      if (errorResult) {
        return new MatchError(errorResult);
      }

      return new Match(match);
    }
    // This is after segment matching, which does not use the reference.
    if (!clause.attributeReference.isValid) {
      return new MatchError(EvalResult.forError(ErrorKinds.MalformedFlag, 'Invalid attribute reference in clause'));
    }

    return new Match(matchClauseWithoutSegmentOperations(clause, context));
  }

  /**
   * Evaluate a flag rule against the given context.
   * @param flag The flag the rule is part of.
   * @param rule The rule to match.
   * @param rule The index of the rule.
   * @param context The context to match the rule against.
   * @returns An {@link EvalResult} or `undefined` if there are no matches or errors.
   */
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
      errorResult = res.result;
      return res.error || res.isMatch;
    });

    if (errorResult) {
      return errorResult;
    }

    if (match) {
      return this.variationForContext(
        rule,
        context,
        flag,
        Reasons.ruleMatch(rule.id, ruleIndex),
      );
    }
    return undefined;
  }

  private variationForContext(
    varOrRollout: VariationOrRollout,
    context: Context,
    flag: Flag,
    reason: LDEvaluationReason,
  ): EvalResult {
    if (varOrRollout === undefined) {
      // By spec this field should be defined, but better to be overly cautious.
      return EvalResult.forError(ErrorKinds.MalformedFlag, 'Fallthrough variation undefined');
    }

    if (varOrRollout.variation !== undefined) { // 0 would be false.
      return getVariation(flag, varOrRollout.variation, reason);
    }

    if (varOrRollout.rollout) {
      const { rollout } = varOrRollout;
      const { variations } = rollout;
      const isExperiment = rollout.kind === 'experiment';

      if (variations && variations.length) {
        const bucketBy = getBucketBy(isExperiment, rollout.bucketByAttributeReference);

        if (!bucketBy.isValid) {
          return EvalResult.forError(
            ErrorKinds.MalformedFlag,
            'Invalid attribute reference for bucketBy in rollout',
          );
        }

        const bucket = this.bucketer.bucket(
          context,
          flag.key,
          bucketBy,
          flag.salt || '', // TODO: This may need some handling.
          isExperiment,
          rollout.contextKind,
          rollout.seed,
        );

        const updatedReason = { ...reason };

        let sum = 0;
        for (let i = 0; i < variations.length; i += 1) {
          const variate = variations[i];
          sum += variate.weight / 100000.0;
          if (bucket < sum) {
            updatedReason.inExperiment = (isExperiment && !variate.untracked) || undefined;
            return getVariation(flag, variate.variation, updatedReason);
          }
        }

        // The context's bucket value was greater than or equal to the end of
        // the last bucket. This could happen due to a rounding error, or due to
        // the fact that we are scaling to 100000 rather than 99999, or the flag
        // data could contain buckets that don't actually add up to 100000.
        // Rather than returning an error in this case (or changing the scaling,
        // which would potentially change the results for *all* users), we will
        // simply put the context in the last bucket.
        const lastVariate = variations[variations.length - 1];
        updatedReason.inExperiment = (isExperiment && !lastVariate.untracked) || undefined;
        return getVariation(flag, lastVariate.variation, updatedReason);
      }
    }
    return EvalResult.forError(ErrorKinds.MalformedFlag, 'Variation/rollout object with no variation or rollout');
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
      errorResult = res.result;
      return res.error || res.isMatch;
    });

    if (errorResult) {
      return new MatchError(errorResult);
    }

    if (match) {
      if (rule.weight === undefined) {
        return new Match(match);
      }
      const bucketBy = getBucketBy(false, rule.bucketByAttributeReference);
      if (!bucketBy.isValid) {
        return new MatchError(EvalResult.forError(ErrorKinds.MalformedFlag, 'Invalid attribute reference in clause'));
      }
      const bucket = this.bucketer.bucket(context, 'TODO: Key', bucketBy, salt || '', false, rule.rolloutContextKind);
      return new Match(bucket < rule.weight);
    }

    return new Match(false);
  }

  // eslint-disable-next-line class-methods-use-this
  async simpleSegmentMatchContext(
    segment: Segment,
    context: Context,
    state: EvalState,
    segmentsVisited: string[],
  ): Promise<MatchOrError> {
    const includeExclude = matchSegmentTargets(segment, context);
    if (includeExclude !== undefined) {
      return new Match(includeExclude);
    }

    let evalResult: EvalResult | undefined;
    const matched = await firstSeriesAsync(segment.rules, async (rule) => {
      const res = await this.segmentRuleMatchContext(
        rule,
        context,
        state,
        segmentsVisited,
        segment.salt,
      );
      evalResult = res.result;
      return res.error || res.isMatch;
    });
    if (evalResult) {
      return new MatchError(evalResult);
    }

    return new Match(matched);
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
      return this.simpleSegmentMatchContext(segment, context, state, segmentsVisited);
    }

    // TODO: Big segments.
    return new Match(false);
  }
}
