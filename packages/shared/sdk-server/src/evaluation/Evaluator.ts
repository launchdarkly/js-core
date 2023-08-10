/* eslint-disable class-methods-use-this */

/* eslint-disable max-classes-per-file */
import { Context, internal, LDEvaluationReason, Platform } from '@launchdarkly/js-sdk-common';

import { BigSegmentStoreMembership } from '../api/interfaces';
import EventFactory from '../events/EventFactory';
import Bucketer from './Bucketer';
import { allSeriesAsync, firstSeriesAsync } from './collection';
import { Clause } from './data/Clause';
import { Flag } from './data/Flag';
import { FlagRule } from './data/FlagRule';
import { Segment } from './data/Segment';
import { SegmentRule } from './data/SegmentRule';
import { VariationOrRollout } from './data/VariationOrRollout';
import ErrorKinds from './ErrorKinds';
import EvalResult from './EvalResult';
import evalTargets from './evalTargets';
import makeBigSegmentRef from './makeBigSegmentRef';
import matchClauseWithoutSegmentOperations from './matchClause';
import matchSegmentTargets from './matchSegmentTargets';
import { Queries } from './Queries';
import Reasons from './Reasons';
import { getBucketBy, getOffVariation, getVariation } from './variations';

type BigSegmentStoreStatusString = 'HEALTHY' | 'STALE' | 'STORE_ERROR' | 'NOT_CONFIGURED';

const bigSegmentsStatusPriority: Record<BigSegmentStoreStatusString, number> = {
  HEALTHY: 1,
  STALE: 2,
  STORE_ERROR: 3,
  NOT_CONFIGURED: 4,
};

function getBigSegmentsStatusPriority(status?: BigSegmentStoreStatusString) {
  if (status !== undefined) {
    return bigSegmentsStatusPriority[status] || 0;
  }
  return 0;
}

/**
 * Given two big segment statuses return the one with the higher priority.
 * @returns The status with the higher priority.
 */
function computeUpdatedBigSegmentsStatus(
  old?: BigSegmentStoreStatusString,
  latest?: BigSegmentStoreStatusString,
): BigSegmentStoreStatusString | undefined {
  if (
    old !== undefined &&
    getBigSegmentsStatusPriority(old) > getBigSegmentsStatusPriority(latest)
  ) {
    return old;
  }
  return latest;
}

class EvalState {
  events?: internal.InputEvalEvent[];

  bigSegmentsStatus?: BigSegmentStoreStatusString;

  bigSegmentsMembership?: Record<string, BigSegmentStoreMembership | null>;
}

class Match {
  public readonly error = false;

  public readonly result?: EvalResult;

  constructor(public readonly isMatch: boolean) {}
}

class MatchError {
  public readonly error = true;

  public readonly isMatch = false;

  constructor(public readonly result: EvalResult) {}
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

  async evaluate(flag: Flag, context: Context, eventFactory?: EventFactory): Promise<EvalResult> {
    return new Promise<EvalResult>((resolve) => {
      const state = new EvalState();
      this.evaluateInternal(
        flag,
        context,
        state,
        (res) => {
          if (state.bigSegmentsStatus) {
            res.detail.reason = {
              ...res.detail.reason,
              bigSegmentsStatus: state.bigSegmentsStatus,
            };
          }
          res.events = state.events;
          resolve(res);
        },
        eventFactory,
      );
    });
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
    // visitedFlags: string[],
    cb: (res: EvalResult) => void,
    eventFactory?: EventFactory,
  ): void {
    if (!flag.on) {
      cb(getOffVariation(flag, Reasons.Off));
    }

    this.checkPrerequisites(
      flag,
      context,
      state,
      // visitedFlags,
      (res) => {
        // If there is a prereq result, then prereqs have failed, or there was
        // an error.
        if (res) {
          cb(res);
          return;
        }

        const targetRes = evalTargets(flag, context);
        if (targetRes) {
          cb(targetRes);
          return;
        }

        this.evaluateRules(flag, context, state, (eval_res) => {
          if (eval_res) {
            cb(eval_res);
            return;
          }

          cb(this.variationForContext(flag.fallthrough, context, flag, Reasons.Fallthrough));
        });
      },
      eventFactory,
    );
  }

  /**
   * Evaluate the prerequisite flags for the given flag.
   * @param flag The flag to evaluate prerequisites for.
   * @param context The context to evaluate the prerequisites against.
   * @param state used to accumulate prerequisite events.
   * @param visitedFlags Used to detect cycles in prerequisite evaluation.
   * @returns An {@link EvalResult} containing an error result or `undefined` if the prerequisites
   * are met.
   */
  private checkPrerequisites(
    flag: Flag,
    context: Context,
    state: EvalState,
    // visitedFlags: string[],
    cb: (res: EvalResult | undefined) => void,
    eventFactory?: EventFactory,
  ): void {
    let prereqResult: EvalResult | undefined;

    if (!flag.prerequisites || !flag.prerequisites.length) {
      cb(undefined);
      return;
    }

    // On any error conditions the prereq result will be set, so we do not need
    // the result of the series evaluation.
    allSeriesAsync(
      flag.prerequisites,
      async (prereq, _index, prereq_cb) => {
        // if (visitedFlags.indexOf(prereq.key) !== -1) {
        //   prereqResult = EvalResult.forError(
        //     ErrorKinds.MalformedFlag,
        //     `Prerequisite of ${flag.key} causing a circular reference.` +
        //       ' This is probably a temporary condition due to an incomplete update.',
        //   );
        //   return false;
        // }
        // const updatedVisitedFlags = [...visitedFlags, prereq.key];
        const prereqFlag = await this.queries.getFlag(prereq.key);

        if (!prereqFlag) {
          prereqResult = getOffVariation(flag, Reasons.prerequisiteFailed(prereq.key));
          prereq_cb(false);
          return;
        }

        this.evaluateInternal(
          prereqFlag,
          context,
          state,
          // updatedVisitedFlags,
          (res) => {
            // eslint-disable-next-line no-param-reassign
            state.events = state.events ?? [];

            if (eventFactory) {
              state.events.push(
                eventFactory.evalEvent(prereqFlag, context, res.detail, null, flag),
              );
            }

            if (res.isError) {
              prereqResult = res;
              return prereq_cb(false);
            }

            if (res.isOff || res.detail.variationIndex !== prereq.variation) {
              prereqResult = getOffVariation(flag, Reasons.prerequisiteFailed(prereq.key));
              return prereq_cb(false);
            }
            return prereq_cb(true);
          },
          eventFactory,
        );
      },
      () => {
        cb(prereqResult);
      },
    );
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
    cb: (res: EvalResult | undefined) => void,
  ): void {
    let ruleResult: EvalResult | undefined;

    firstSeriesAsync(
      flag.rules,
      (rule, ruleIndex, ruleCb: (res: boolean) => void) => {
        this.ruleMatchContext(flag, rule, ruleIndex, context, state, [], (res) => {
          ruleResult = res;
          ruleCb(!!res);
        });
      },
      () => cb(ruleResult),
    );
  }

  private clauseMatchContext(
    clause: Clause,
    context: Context,
    segmentsVisited: string[],
    state: EvalState,
    cb: (res: MatchOrError) => void,
  ): void {
    let errorResult: EvalResult | undefined;
    if (clause.op === 'segmentMatch') {
      firstSeriesAsync(
        clause.values,
        async (value, _index, innerCB) => {
          const segment = await this.queries.getSegment(value);
          if (segment) {
            if (segmentsVisited.includes(segment.key)) {
              errorResult = EvalResult.forError(
                ErrorKinds.MalformedFlag,
                `Segment rule referencing segment ${segment.key} caused a circular reference. ` +
                  'This is probably a temporary condition due to an incomplete update',
              );
              // There was an error, so stop checking further segments.
              innerCB(true);
              return;
            }

            const newVisited = [...segmentsVisited, segment?.key];
            this.segmentMatchContext(segment, context, state, newVisited, (res) => {
              if (res.error) {
                errorResult = res.result;
              }
              innerCB(res.error || res.isMatch);
            });
            innerCB(false);
          }
        },
        (match) => {
          if (errorResult) {
            return cb(new MatchError(errorResult));
          }

          return cb(new Match(match));
        },
      );
      // TODO: Should this return here?
      return;
    }
    // This is after segment matching, which does not use the reference.
    if (!clause.attributeReference.isValid) {
      cb(
        new MatchError(
          EvalResult.forError(ErrorKinds.MalformedFlag, 'Invalid attribute reference in clause'),
        ),
      );
      return;
    }

    cb(new Match(matchClauseWithoutSegmentOperations(clause, context)));
  }

  /**
   * Evaluate a flag rule against the given context.
   * @param flag The flag the rule is part of.
   * @param rule The rule to match.
   * @param rule The index of the rule.
   * @param context The context to match the rule against.
   * @returns An {@link EvalResult} or `undefined` if there are no matches or errors.
   */
  private ruleMatchContext(
    flag: Flag,
    rule: FlagRule,
    ruleIndex: number,
    context: Context,
    state: EvalState,
    segmentsVisited: string[],
    cb: (res: EvalResult | undefined) => void,
  ): void {
    if (!rule.clauses) {
      return;
    }
    let errorResult: EvalResult | undefined;
    allSeriesAsync(
      rule.clauses,
      (clause, _index, rule_cb) => {
        this.clauseMatchContext(clause, context, segmentsVisited, state, (res) => {
          errorResult = res.result;
          return rule_cb(res.error || res.isMatch);
        });
      },
      (match) => {
        if (errorResult) {
          return cb(errorResult);
        }

        if (match) {
          return cb(
            this.variationForContext(rule, context, flag, Reasons.ruleMatch(rule.id, ruleIndex)),
          );
        }
        return cb(undefined);
      },
    );
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

    if (varOrRollout.variation !== undefined) {
      // 0 would be false.
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

        const [bucket, hadContext] = this.bucketer.bucket(
          context,
          flag.key,
          bucketBy,
          flag.salt || '',
          rollout.contextKind,
          rollout.seed,
        );

        const updatedReason = { ...reason };

        let sum = 0;
        for (let i = 0; i < variations.length; i += 1) {
          const variate = variations[i];
          sum += variate.weight / 100000.0;
          if (bucket < sum) {
            if (isExperiment && hadContext && !variate.untracked) {
              updatedReason.inExperiment = true;
            }
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
        if (isExperiment && !lastVariate.untracked) {
          updatedReason.inExperiment = true;
        }
        return getVariation(flag, lastVariate.variation, updatedReason);
      }
    }
    return EvalResult.forError(
      ErrorKinds.MalformedFlag,
      'Variation/rollout object with no variation or rollout',
    );
  }

  segmentRuleMatchContext(
    segment: Segment,
    rule: SegmentRule,
    context: Context,
    state: EvalState,
    segmentsVisited: string[],
    cb: (res: MatchOrError) => void,
  ): void {
    let errorResult: EvalResult | undefined;
    allSeriesAsync(
      rule.clauses,
      (clause, _index, innerCb) => {
        this.clauseMatchContext(clause, context, segmentsVisited, state, (res) => {
          errorResult = res.result;
          innerCb(res.error || res.isMatch);
        });
      },
      (match) => {
        if (errorResult) {
          return cb(new MatchError(errorResult));
        }

        if (match) {
          if (rule.weight === undefined) {
            return cb(new Match(match));
          }
          const bucketBy = getBucketBy(false, rule.bucketByAttributeReference);
          if (!bucketBy.isValid) {
            return cb(
              new MatchError(
                EvalResult.forError(
                  ErrorKinds.MalformedFlag,
                  'Invalid attribute reference in clause',
                ),
              ),
            );
          }

          const [bucket] = this.bucketer.bucket(
            context,
            segment.key,
            bucketBy,
            segment.salt || '',
            rule.rolloutContextKind,
          );
          return cb(new Match(bucket < rule.weight / 100000.0));
        }

        return cb(new Match(false));
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this
  simpleSegmentMatchContext(
    segment: Segment,
    context: Context,
    state: EvalState,
    segmentsVisited: string[],
    cb: (res: MatchOrError) => void,
  ): void {
    if (!segment.unbounded) {
      const includeExclude = matchSegmentTargets(segment, context);
      if (includeExclude !== undefined) {
        cb(new Match(includeExclude));
        return;
      }
    }

    let evalResult: EvalResult | undefined;
    firstSeriesAsync(
      segment.rules,
      (rule, _index, innerCb) => {
        this.segmentRuleMatchContext(segment, rule, context, state, segmentsVisited, (res) => {
          evalResult = res.result;
          return innerCb(res.error || res.isMatch);
        });
      },
      (matched) => {
        if (evalResult) {
          return cb(new MatchError(evalResult));
        }

        return cb(new Match(matched));
      },
    );
  }

  segmentMatchContext(
    segment: Segment,
    context: Context,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    state: EvalState,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    segmentsVisited: string[],
    cb: (res: MatchOrError) => void,
  ): void {
    if (!segment.unbounded) {
      this.simpleSegmentMatchContext(segment, context, state, segmentsVisited, cb);
      return;
    }

    const bigSegmentKind = segment.unboundedContextKind || 'user';
    const keyForBigSegment = context.key(bigSegmentKind);

    if (!keyForBigSegment) {
      cb(new Match(false));
      return;
    }

    if (!segment.generation) {
      // Big Segment queries can only be done if the generation is known. If it's unset,
      // that probably means the data store was populated by an older SDK that doesn't know
      // about the generation property and therefore dropped it from the JSON data. We'll treat
      // that as a "not configured" condition.
      // eslint-disable-next-line no-param-reassign
      state.bigSegmentsStatus = computeUpdatedBigSegmentsStatus(
        state.bigSegmentsStatus,
        'NOT_CONFIGURED',
      );
      cb(new Match(false));
      return;
    }

    if (state.bigSegmentsMembership && state.bigSegmentsMembership[keyForBigSegment]) {
      // We've already done the query at some point during the flag evaluation and stored
      // the result (if any) in stateOut.bigSegmentsMembership, so we don't need to do it
      // again. Even if multiple Big Segments are being referenced, the membership includes
      // *all* of the user's segment memberships.

      this.bigSegmentMatchContext(
        state.bigSegmentsMembership[keyForBigSegment],
        segment,
        context,
        state,
      ).then(cb);
    }

    this.queries.getBigSegmentsMembership(keyForBigSegment).then((result) => {
      // eslint-disable-next-line no-param-reassign
      state.bigSegmentsMembership = state.bigSegmentsMembership || {};
      if (result) {
        const [membership, status] = result;
        // eslint-disable-next-line no-param-reassign
        state.bigSegmentsMembership[keyForBigSegment] = membership;
        // eslint-disable-next-line no-param-reassign
        state.bigSegmentsStatus = computeUpdatedBigSegmentsStatus(
          state.bigSegmentsStatus,
          status as BigSegmentStoreStatusString,
        );
      } else {
        // eslint-disable-next-line no-param-reassign
        state.bigSegmentsStatus = computeUpdatedBigSegmentsStatus(
          state.bigSegmentsStatus,
          'NOT_CONFIGURED',
        );
      }
      /* eslint-enable no-param-reassign */
      this.bigSegmentMatchContext(
        state.bigSegmentsMembership[keyForBigSegment],
        segment,
        context,
        state,
      ).then(cb);
    });
  }

  bigSegmentMatchContext(
    membership: BigSegmentStoreMembership | null,
    segment: Segment,
    context: Context,
    state: EvalState,
  ): Promise<MatchOrError> {
    const segmentRef = makeBigSegmentRef(segment);
    const included = membership?.[segmentRef];
    return new Promise<MatchOrError>((resolve) => {
      // Typically null is not checked because we filter it from the data
      // we get in flag updates. Here it is checked because big segment data
      // will be contingent on the store that implements it.
      if (included !== undefined && included !== null) {
        resolve(new Match(included));
        return;
      }
      this.simpleSegmentMatchContext(segment, context, state, [], resolve);
    });
  }
}
