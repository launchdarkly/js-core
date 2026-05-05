import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { LDAIAgentConfig } from './config/types';
import { LDJudgeResult } from './judge/types';
import { LDAIMetricSummary, ManagedResult, RunnerResult } from './model/types';
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

    const metrics: LDAIMetricSummary = {
      success: result.metrics.success,
      usage: result.metrics.usage,
      toolCalls: result.metrics.toolCalls,
      durationMs: result.metrics.durationMs,
      resumptionToken: tracker.resumptionToken,
    };

    const output = result.content;
    const evaluator = this.aiAgentConfig.evaluator;
    let evaluations: Promise<LDJudgeResult[]>;
    if (evaluator) {
      evaluations = evaluator
        .evaluate(prompt, output)
        .then((results) => {
          results.forEach((judgeResult) => {
            tracker.trackJudgeResult(judgeResult);
          });
          return results;
        })
        .catch((err) => {
          this._logger?.warn('Judge evaluation failed unexpectedly:', err);
          return [];
        });
    } else {
      evaluations = Promise.resolve([]);
    }

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
