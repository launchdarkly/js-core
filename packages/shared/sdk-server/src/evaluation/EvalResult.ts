import { internal, LDEvaluationDetail, LDEvaluationReason } from '@launchdarkly/js-sdk-common';

import Reasons from './Reasons';

/**
 * A class which encapsulates the result of an evaluation. It allows for differentiating between
 * successful and error result types.
 *
 * @internal
 */
export default class EvalResult {
  public events?: internal.InputEvalEvent[];
  public prerequisites?: string[];

  /**
   * True when an override affected this evaluation, directly or transitively. The evaluator sets
   * it from its own record of the definitions it read. Event generation keys on this field and
   * does not read the reason. The reason reports the same state through `overrideAffected`.
   */
  public overrideAffected: boolean = false;

  protected constructor(
    public readonly isError: boolean,
    public readonly detail: LDEvaluationDetail,
    public readonly message?: string,
  ) {
    this.isError = isError;
    this.detail = detail;
    this.message = message;
  }

  public get isOff() {
    return this.detail.reason.kind === Reasons.Off.kind;
  }

  public setDefault(def: any) {
    this.detail.value = def;
  }

  static forError(errorKind: internal.ErrorKinds, message?: string, def?: any): EvalResult {
    return new EvalResult(
      true,
      {
        value: def ?? null,
        variationIndex: null,
        reason: { kind: 'ERROR', errorKind },
      },
      message,
    );
  }

  static forSuccess(value: any, reason: LDEvaluationReason, variationIndex?: number) {
    return new EvalResult(false, {
      value,
      variationIndex: variationIndex === undefined ? null : variationIndex,
      reason,
    });
  }
}
