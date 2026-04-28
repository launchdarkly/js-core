import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { LDJudgeConfiguration } from '../config/types';
import { Judge } from './Judge';
import { LDJudgeResult } from './types';

/**
 * Wraps a collection of judges and a judge configuration, providing a single
 * `evaluate` method that runs all configured judges against a given input/output pair.
 *
 * The `Evaluator` is responsible only for running judges and returning results.
 * It does NOT call `tracker.trackJudgeResult` — that is the responsibility of
 * the managed layer (e.g., ManagedModel, ManagedAgent).
 */
export class Evaluator {
  constructor(
    readonly judges: Map<string, Judge>,
    readonly judgeConfiguration: LDJudgeConfiguration,
    private readonly _logger?: LDLogger,
  ) {}

  /**
   * Returns a no-op Evaluator that always resolves to an empty array.
   * Use this when no judges are configured.
   */
  static noop(): Evaluator {
    return new Evaluator(new Map(), { judges: [] });
  }

  /**
   * Evaluates the given input/output pair using all configured judges.
   * Missing judge instances are logged as warnings and skipped (not errors).
   *
   * @param input The input that was provided to the AI model.
   * @param output The output produced by the AI model.
   * @returns A promise resolving to an array of judge evaluation results.
   */
  async evaluate(input: string, output: string): Promise<LDJudgeResult[]> {
    if (this.judgeConfiguration.judges.length === 0) {
      return [];
    }

    const evaluationPromises = this.judgeConfiguration.judges.map(async (judgeConfig) => {
      const judge = this.judges.get(judgeConfig.key);
      if (!judge) {
        this._logger?.warn(`Judge configuration is not enabled for ${judgeConfig.key}`);
        // Skip — missing judge is a warning, not an error result
        return null;
      }

      try {
        return await judge.evaluate(input, output, judgeConfig.samplingRate);
      } catch (err) {
        const result: LDJudgeResult = {
          success: false,
          sampled: true,
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
        };
        return result;
      }
    });

    const settled = await Promise.allSettled(evaluationPromises);

    const results: LDJudgeResult[] = [];
    settled.forEach((item) => {
      if (item.status === 'fulfilled' && item.value !== null) {
        results.push(item.value);
      } else if (item.status === 'rejected') {
        results.push({
          success: false,
          sampled: true,
          errorMessage: 'Judge evaluation failed unexpectedly',
        });
      }
    });

    return results;
  }
}
