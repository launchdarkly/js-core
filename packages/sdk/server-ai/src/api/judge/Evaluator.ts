import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { Judge } from './Judge';
import { LDJudgeResult } from './types';

/**
 * Wraps a collection of judges and provides a single `evaluate` method that
 * runs all of them against a given input/output pair.
 *
 * Each `Judge` is constructed with its own sampling rate, so the Evaluator
 * just iterates and asks each judge to evaluate; per-judge sampling decisions
 * happen inside the judge.
 *
 * The `Evaluator` is responsible only for running judges and returning results.
 * It does NOT call `tracker.trackJudgeResult` — that is the responsibility of
 * the managed layer (e.g., ManagedModel, ManagedAgent).
 *
 * @internal
 */
export class Evaluator {
  constructor(
    private readonly _judges: Judge[],
    private readonly _logger?: LDLogger,
  ) {}

  /**
   * Returns a no-op Evaluator that always resolves to an empty array.
   * Use this when no judges are configured.
   */
  static noop(): Evaluator {
    return new Evaluator([]);
  }

  /**
   * Evaluates the given input/output pair using all configured judges.
   *
   * @param input The input that was provided to the AI model.
   * @param output The output produced by the AI model.
   * @returns A promise resolving to an array of judge evaluation results.
   */
  async evaluate(input: string, output: string): Promise<LDJudgeResult[]> {
    if (this._judges.length === 0) {
      // Same behavior as Evaluator.noop().evaluate() — keep these aligned if
      // the noop path ever becomes fancier (e.g., debug logging).
      return [];
    }

    const evaluationPromises = this._judges.map(async (judge) => {
      try {
        return await judge.evaluate(input, output);
      } catch (err) {
        this._logger?.error('Judge evaluation failed unexpectedly:', err);
        const result: LDJudgeResult = {
          success: false,
          sampled: true,
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
          judgeConfigKey: judge.getAIConfig().key,
        };
        return result;
      }
    });

    return Promise.all(evaluationPromises);
  }
}
