/**
 * Describes the reason that a flag evaluation produced a particular value. This is
 * part of the {@link LDEvaluationDetail} object returned by `LDClient.variationDetail`.
 */
export interface LDEvaluationReason {
  /**
   * The general category of the reason:
   *
   * - `'OFF'`: The flag was off and therefore returned its configured off value.
   * - `'FALLTHROUGH'`: The flag was on but the context did not match any targets or rules.
   * - `'TARGET_MATCH'`: The context key was specifically targeted for this flag.
   * - `'RULE_MATCH'`: the context matched one of the flag's rules.
   * - `'PREREQUISITE_FAILED'`: The flag was considered off because it had at least one
   *   prerequisite flag that either was off or did not return the desired variation.
   * - `'ERROR'`: The flag could not be evaluated, e.g. because it does not exist or due
   *   to an unexpected error.
   */
  kind: string;

  /**
   * A further description of the error condition, if the kind was `'ERROR'`.
   */
  errorKind?: string;

  /**
   * The index of the matched rule (0 for the first), if the kind was `'RULE_MATCH'`.
   */
  ruleIndex?: number;

  /**
   * The unique identifier of the matched rule, if the kind was `'RULE_MATCH'`.
   */
  ruleId?: string;

  /**
   * The key of the failed prerequisite flag, if the kind was `'PREREQUISITE_FAILED'`.
   */
  prerequisiteKey?: string;

  /**
   * Whether the evaluation was part of an experiment.
   *
   * This is true if the evaluation resulted in an experiment rollout and served one of
   * the variations in the experiment. Otherwise it is false or undefined.
   */
  inExperiment?: boolean;

  /**
   * Describes the validity of Big Segment information, if and only if the flag evaluation
   * required querying at least one Big Segment.
   *
   * - `'HEALTHY'`: The Big Segment query involved in the flag evaluation was successful, and
   *   the segment state is considered up to date.
   * - `'STALE'`: The Big Segment query involved in the flag evaluation was successful, but
   *   the segment state may not be up to date
   * - `'NOT_CONFIGURED'`: Big Segments could not be queried for the flag evaluation because
   *   the SDK configuration did not include a Big Segment store.
   * - `'STORE_ERROR'`: The Big Segment query involved in the flag evaluation failed, for
   *   instance due to a database error.
   */
  bigSegmentsStatus?: 'HEALTHY' | 'STALE' | 'NOT_CONFIGURED' | 'STORE_ERROR';
}
