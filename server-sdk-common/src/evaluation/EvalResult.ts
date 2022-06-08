import { LDEvaluationDetail, LDEvaluationReason } from '../api';
import ErrorKinds from './ErrorKinds';

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

  static ForError(errorKind: ErrorKinds, message?: string): EvalResult {
    return new EvalResult(true, {
      value: null,
      variationIndex: undefined,
      reason: { kind: 'ERROR', errorKind },
    }, message);
  }

  static ForSuccess(value: any, reason: LDEvaluationReason, variationIndex?: number) {
    return new EvalResult(false, {
      value,
      variationIndex,
      reason,
    });
  }
}
