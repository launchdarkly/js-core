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
import EvalResult from './EvalResult';
import evalTargets from './evalTargets';
import makeBigSegmentRef from './makeBigSegmentRef';
import matchClauseWithoutSegmentOperations, { maybeNegate } from './matchClause';
import matchSegmentTargets from './matchSegmentTargets';
import { Queries } from './Queries';
import Reasons from './Reasons';
import { getBucketBy, getOffVariation, getVariation } from './variations';

const { ErrorKinds } = internal;

/**
 * PERFORMANCE NOTE: The evaluation algorithm uses callbacks instead of async/await to optimize
 * performance. This is most important for collections where iterating through rules/clauses
 * has substantial overhead if each iteration involves a promise. For evaluations which do not
 * involve large collections the evaluation should not have to defer execution. Large collections
 * cannot be iterated recursively because stack could become exhausted, when a collection is large
 * we defer the execution of the iterations to prevent stack overflows.
 */

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

interface EvalState {
  events?: internal.InputEvalEvent[];
  prerequisites?: string[];

  bigSegmentsStatus?: BigSegmentStoreStatusString;

  bigSegmentsMembership?: Record<string, BigSegmentStoreMembership | null>;

  /**
   * True once the top-level result has been handed to the caller. Nothing is delivered twice.
   */
  delivered: boolean;

  /**
   * Receives an exception raised while reading the flag, or a prerequisite or segment it
   * references, so that it can be delivered as an error result instead of escaping. The state
   * is shared with prerequisite evaluations, so an exception in a prerequisite fails the
   * top-level flag.
   */
  onError: (err: unknown) => void;
}

interface Match {
  error: false;
  isMatch: boolean;
  result: undefined;
}

interface MatchError {
  error: true;
  isMatch: false;
  result?: EvalResult;
}

function makeMatch(match: boolean): Match {
  return { error: false, isMatch: match, result: undefined };
}

function makeError(result: EvalResult): MatchError {
  return { error: true, isMatch: false, result };
}

/**
 * Run part of an evaluation that may execute outside of the try/catch in evaluateCb, such as
 * the continuation of a store lookup, routing any exception to the state's error handler.
 */
function guarded(state: EvalState, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    state.onError(err);
  }
}

/**
 * Deliver the top-level result to the caller exactly once, decorated with the state
 * accumulated during the evaluation.
 */
function deliverResult(state: EvalState, res: EvalResult, cb: (res: EvalResult) => void): void {
  if (state.delivered) {
    return;
  }
  state.delivered = true;
  if (state.bigSegmentsStatus) {
    res.detail.reason = {
      ...res.detail.reason,
      bigSegmentsStatus: state.bigSegmentsStatus,
    };
  }
  if (state.prerequisites) {
    res.prerequisites = state.prerequisites;
  }
  res.events = state.events;
  cb(res);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
  private _queries: Queries;

  private _bucketer: Bucketer;

  constructor(platform: Platform, queries: Queries) {
    this._queries = queries;
    this._bucketer = new Bucketer(platform.crypto);
  }

  async evaluate(flag: Flag, context: Context, eventFactory?: EventFactory): Promise<EvalResult> {
    return new Promise<EvalResult>((resolve) => {
      this.evaluateCb(flag, context, resolve, eventFactory);
    });
  }

  evaluateCb(
    flag: Flag,
    context: Context,
    cb: (res: EvalResult) => void,
    eventFactory?: EventFactory,
  ) {
    const state: EvalState = {
      delivered: false,
      onError: (err) => {
        if (state.delivered) {
          // The result has already been handed to the caller, so this exception came from the
          // caller's callback or from work that ran after delivery, not from reading the flag.
          // Let it propagate as it did before.
          throw err;
        }
        deliverResult(
          state,
          EvalResult.forError(
            ErrorKinds.MalformedFlag,
            `Flag "${flag.key}" has a malformed definition, or references a malformed` +
              ` prerequisite or segment: ${errorMessage(err)}`,
          ),
          cb,
        );
      },
    };
    // Reading a malformed definition throws, and most of an evaluation runs synchronously, so
    // this guard turns those exceptions into an error result. Steps that resume after a store
    // callback or a promise are guarded where they resume.
    guarded(state, () => {
      this._evaluateInternal(
        flag,
        context,
        state,
        [],
        (res) => deliverResult(state, res, cb),
        true,
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
   * @param topLevel True when this function is being called in the direct evaluation of a flag,
   * versus the evaluataion of a prerequisite.
   */
  private _evaluateInternal(
    flag: Flag,
    context: Context,
    state: EvalState,
    visitedFlags: string[],
    cb: (res: EvalResult) => void,
    topLevel: boolean,
    eventFactory?: EventFactory,
  ): void {
    if (!flag.on) {
      cb(getOffVariation(flag, Reasons.Off));
      return;
    }

    this._checkPrerequisites(
      flag,
      context,
      state,
      visitedFlags,
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

        this._evaluateRules(flag, context, state, (evalRes) => {
          if (evalRes) {
            cb(evalRes);
            return;
          }

          cb(this._variationForContext(flag.fallthrough, context, flag, Reasons.Fallthrough));
        });
      },
      topLevel,
      eventFactory,
    );
  }

  /**
   * Evaluate the prerequisite flags for the given flag.
   * @param flag The flag to evaluate prerequisites for.
   * @param context The context to evaluate the prerequisites against.
   * @param state used to accumulate prerequisite events.
   * @param visitedFlags Used to detect cycles in prerequisite evaluation.
   * @param cb A callback which is executed when prerequisite checks are complete it is called with
   * an {@link EvalResult} containing an error result or `undefined` if the prerequisites
   * are met.
   * @param topLevel True when this function is being called in the direct evaluation of a flag,
   * versus the evaluataion of a prerequisite.
   */
  private _checkPrerequisites(
    flag: Flag,
    context: Context,
    state: EvalState,
    visitedFlags: string[],
    cb: (res: EvalResult | undefined) => void,
    topLevel: boolean,
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
      (prereq, _index, iterCb) => {
        if (visitedFlags.indexOf(prereq.key) !== -1) {
          prereqResult = EvalResult.forError(
            ErrorKinds.MalformedFlag,
            `Prerequisite of ${flag.key} causing a circular reference.` +
              ' This is probably a temporary condition due to an incomplete update.',
          );
          iterCb(true);
          return;
        }
        const updatedVisitedFlags = [...visitedFlags, prereq.key];
        this._queries.getFlag(prereq.key, (prereqFlag) =>
          // The store may call back asynchronously, after the try/catch around the top-level
          // evaluation has left the stack, so the continuation is guarded here.
          guarded(state, () => {
            if (!prereqFlag) {
              prereqResult = getOffVariation(flag, Reasons.prerequisiteFailed(prereq.key));
              iterCb(false);
              return;
            }

            this._evaluateInternal(
              prereqFlag,
              context,
              state,
              updatedVisitedFlags,
              (res) => {
                state.events ??= [];
                if (topLevel) {
                  state.prerequisites ??= [];

                  state.prerequisites.push(prereqFlag.key);
                }
                if (eventFactory) {
                  state.events.push(
                    eventFactory.evalEventServer(prereqFlag, context, res.detail, null, flag),
                  );
                }

                if (res.isError) {
                  prereqResult = res;
                  return iterCb(false);
                }

                if (res.isOff || res.detail.variationIndex !== prereq.variation) {
                  prereqResult = getOffVariation(flag, Reasons.prerequisiteFailed(prereq.key));
                  return iterCb(false);
                }
                return iterCb(true);
              },
              false, // topLevel false evaluating the prerequisite.
              eventFactory,
            );
          }),
        );
      },
      () => {
        cb(prereqResult);
      },
      state.onError,
    );
  }

  /**
   * Evaluate the rules for a flag and return an {@link EvalResult} if there is
   * a match or error.
   * @param flag The flag to evaluate rules for.
   * @param context The context to evaluate the rules against.
   * @param state The current evaluation state.
   * @param cb Callback called when rule evaluation is complete, it will be called with either
   * an {@link EvalResult} or 'undefined'.
   */
  private _evaluateRules(
    flag: Flag,
    context: Context,
    state: EvalState,
    cb: (res: EvalResult | undefined) => void,
  ): void {
    let ruleResult: EvalResult | undefined;

    firstSeriesAsync(
      flag.rules,
      (rule, ruleIndex, iterCb: (res: boolean) => void) => {
        this._ruleMatchContext(flag, rule, ruleIndex, context, state, [], (res) => {
          ruleResult = res;
          iterCb(!!res);
        });
      },
      () => cb(ruleResult),
      state.onError,
    );
  }

  private _clauseMatchContext(
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
        (value, _index, iterCb) => {
          this._queries.getSegment(value, (segment) =>
            // The store may call back asynchronously; see _checkPrerequisites.
            guarded(state, () => {
              if (segment) {
                if (segmentsVisited.includes(segment.key)) {
                  errorResult = EvalResult.forError(
                    ErrorKinds.MalformedFlag,
                    `Segment rule referencing segment ${segment.key} caused a circular reference. ` +
                      'This is probably a temporary condition due to an incomplete update',
                  );
                  // There was an error, so stop checking further segments.
                  iterCb(true);
                  return;
                }

                const newVisited = [...segmentsVisited, segment?.key];
                this.segmentMatchContext(segment, context, state, newVisited, (res) => {
                  if (res.error) {
                    errorResult = res.result;
                  }
                  iterCb(res.error || res.isMatch);
                });
              } else {
                iterCb(false);
              }
            }),
          );
        },
        (match) => {
          if (errorResult) {
            return cb(makeError(errorResult));
          }

          return cb(makeMatch(maybeNegate(clause, match)));
        },
        state.onError,
      );
      return;
    }
    // This is after segment matching, which does not use the reference.
    if (!clause.attributeReference.isValid) {
      cb(
        makeError(
          EvalResult.forError(ErrorKinds.MalformedFlag, 'Invalid attribute reference in clause'),
        ),
      );
      return;
    }

    cb(makeMatch(matchClauseWithoutSegmentOperations(clause, context)));
  }

  /**
   * Evaluate a flag rule against the given context.
   * @param flag The flag the rule is part of.
   * @param rule The rule to match.
   * @param rule The index of the rule.
   * @param context The context to match the rule against.
   * @param cb Called when matching is complete with an {@link EvalResult} or `undefined` if there
   * are no matches or errors.
   */
  private _ruleMatchContext(
    flag: Flag,
    rule: FlagRule,
    ruleIndex: number,
    context: Context,
    state: EvalState,
    segmentsVisited: string[],
    cb: (res: EvalResult | undefined) => void,
  ): void {
    if (!rule.clauses) {
      cb(undefined);
      return;
    }
    let errorResult: EvalResult | undefined;
    allSeriesAsync(
      rule.clauses,
      (clause, _index, iterCb) => {
        this._clauseMatchContext(clause, context, segmentsVisited, state, (res) => {
          errorResult = res.result;
          return iterCb(res.error || res.isMatch);
        });
      },
      (match) => {
        if (errorResult) {
          return cb(errorResult);
        }

        if (match) {
          return cb(
            this._variationForContext(rule, context, flag, Reasons.ruleMatch(rule.id, ruleIndex)),
          );
        }
        return cb(undefined);
      },
      state.onError,
    );
  }

  private _variationForContext(
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

        const [bucket, hadContext] = this._bucketer.bucket(
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
      (clause, _index, iterCb) => {
        this._clauseMatchContext(clause, context, segmentsVisited, state, (res) => {
          errorResult = res.result;
          iterCb(res.error || res.isMatch);
        });
      },
      (match) => {
        if (errorResult) {
          return cb(makeError(errorResult));
        }

        if (match) {
          if (rule.weight === undefined) {
            return cb(makeMatch(match));
          }
          const bucketBy = getBucketBy(false, rule.bucketByAttributeReference);
          if (!bucketBy.isValid) {
            return cb(
              makeError(
                EvalResult.forError(
                  ErrorKinds.MalformedFlag,
                  'Invalid attribute reference in clause',
                ),
              ),
            );
          }

          const [bucket] = this._bucketer.bucket(
            context,
            segment.key,
            bucketBy,
            segment.salt || '',
            rule.rolloutContextKind,
          );
          return cb(makeMatch(bucket < rule.weight / 100000.0));
        }

        return cb(makeMatch(false));
      },
      state.onError,
    );
  }

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
        cb(makeMatch(includeExclude));
        return;
      }
    }

    let evalResult: EvalResult | undefined;
    firstSeriesAsync(
      segment.rules,
      (rule, _index, iterCb) => {
        this.segmentRuleMatchContext(segment, rule, context, state, segmentsVisited, (res) => {
          evalResult = res.result;
          return iterCb(res.error || res.isMatch);
        });
      },
      (matched) => {
        if (evalResult) {
          return cb(makeError(evalResult));
        }

        return cb(makeMatch(matched));
      },
      state.onError,
    );
  }

  segmentMatchContext(
    segment: Segment,
    context: Context,
    state: EvalState,
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
      cb(makeMatch(false));
      return;
    }

    if (!segment.generation) {
      // Big Segment queries can only be done if the generation is known. If it's unset,
      // that probably means the data store was populated by an older SDK that doesn't know
      // about the generation property and therefore dropped it from the JSON data. We'll treat
      // that as a "not configured" condition.
      state.bigSegmentsStatus = computeUpdatedBigSegmentsStatus(
        state.bigSegmentsStatus,
        'NOT_CONFIGURED',
      );
      cb(makeMatch(false));
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
      )
        .then(cb)
        .catch(state.onError);
      return;
    }

    this._queries
      .getBigSegmentsMembership(keyForBigSegment)
      .then((result) => {
        state.bigSegmentsMembership = state.bigSegmentsMembership || {};
        if (result) {
          const [membership, status] = result;
          state.bigSegmentsMembership[keyForBigSegment] = membership;
          state.bigSegmentsStatus = computeUpdatedBigSegmentsStatus(
            state.bigSegmentsStatus,
            status as BigSegmentStoreStatusString,
          );
        } else {
          state.bigSegmentsStatus = computeUpdatedBigSegmentsStatus(
            state.bigSegmentsStatus,
            'NOT_CONFIGURED',
          );
        }
        return this.bigSegmentMatchContext(
          state.bigSegmentsMembership[keyForBigSegment],
          segment,
          context,
          state,
        );
      })
      .then(cb)
      // The rest of the evaluation runs inside these continuations, so an exception there would
      // otherwise be an unhandled rejection and the result would never be delivered.
      .catch(state.onError);
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
        resolve(makeMatch(included));
        return;
      }
      this.simpleSegmentMatchContext(segment, context, state, [], resolve);
    });
  }
}
