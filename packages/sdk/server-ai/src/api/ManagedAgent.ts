import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { LDAIAgentConfig } from './config/types';
import { ManagedResult, RunnerResult } from './model/types';
import { Runner } from './providers/Runner';

/**
 * ManagedAgent provides agent invocation with automatic tracking and automatic
 * judge evaluation.
 *
 * The class is stateless: each `run()` call sends the prompt directly to the
 * underlying `Runner` and returns a `ManagedResult`. Conversation history,
 * if any, must be managed by the caller (or by the Runner implementation).
 *
 * Obtain an instance via `LDAIClient.createAgent()`.
 */
export class ManagedAgent {
  constructor(
    protected readonly aiAgentConfig: LDAIAgentConfig,
    protected readonly runner: Runner,
    private readonly _logger?: LDLogger,
  ) {}

  /**
   * Invoke the agent with a prompt string and return a ManagedResult.
   *
   * `run()` resolves before `ManagedResult.evaluations` resolves. Awaiting
   * `evaluations` guarantees both judge evaluation and tracker.trackJudgeResult()
   * are complete.
   *
   * @param prompt The user input to send to the agent.
   * @returns Promise resolving to ManagedResult (before evaluations settle).
   */
  async run(prompt: string): Promise<ManagedResult> {
    const tracker = this.aiAgentConfig.createTracker!();

    const result = await tracker.trackMetricsOf(
      (r: RunnerResult) => r.metrics,
      () => this.runner.run(prompt),
    );

    const metrics = tracker.getSummary();

    const output = result.content;
    const evaluations = this.aiAgentConfig.evaluator
      .evaluate(prompt, output)
      .then((results) => {
        results.forEach((judgeResult) => {
          if (!judgeResult.sampled) {
            return;
          }
          tracker.trackJudgeResult(judgeResult);
        });
        return results;
      })
      .catch((err) => {
        this._logger?.warn('Judge evaluation failed unexpectedly:', err);
        return [];
      });

    return {
      content: output,
      metrics,
      raw: result.raw,
      parsed: result.parsed,
      evaluations,
    };
  }

  /**
   * Get the underlying AI agent configuration used to initialize this ManagedAgent.
   */
  getConfig(): LDAIAgentConfig {
    return this.aiAgentConfig;
  }
}
