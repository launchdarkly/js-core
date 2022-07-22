import { LDEvaluationDetail, LDEvaluationReason } from '../api';
import ErrorKinds from './ErrorKinds';
import Reasons from './Reasons';

/**
 * A class which encapsulates the result of an evaluation. It allows for differentiating between
 * successful and error result types.
 *
 * @internal
 */
export default class EvalResult {
  public readonly isError: boolean;

  public readonly detail: LDEvaluationDetail;

  public readonly message?: string;

  protected constructor(isError: boolean, detail: LDEvaluationDetail, message?: string) {
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

  static forError(errorKind: ErrorKinds, message?: string, def?: any): EvalResult {
    return new EvalResult(true, {
      value: def ?? null,
      variationIndex: undefined,
      reason: { kind: 'ERROR', errorKind },
    }, message);
  }

  static forSuccess(value: any, reason: LDEvaluationReason, variationIndex?: number) {
    return new EvalResult(false, {
      value,
      variationIndex,
      reason,
    });
  }
}
