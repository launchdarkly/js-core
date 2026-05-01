import { Judge } from './Judge';
import { LDJudgeResult } from './types';

/**
 * Wraps a collection of judges, providing a single `evaluate` method that
 * runs all judges against a given input/output pair.
 *
 * @internal
 */
export class Evaluator {
  constructor(private readonly _judges: Judge[]) {}

  static noop(): Evaluator {
    return new Evaluator([]);
  }

  async evaluate(input: string, output: string): Promise<LDJudgeResult[]> {
    if (this._judges.length === 0) {
      return [];
    }

    return Promise.all(this._judges.map((judge) => judge.evaluate(input, output)));
  }
}
