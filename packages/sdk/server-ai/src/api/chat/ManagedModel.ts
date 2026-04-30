import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { LDAICompletionConfig } from '../config/types';
import { LDJudgeResult } from '../judge/types';
import { LDAIMetricSummary, ManagedResult, RunnerResult } from '../model/types';
import { Runner } from '../providers/Runner';

/**
 * ManagedModel provides chat-completion invocation with automatic tracking and
 * (in a future PR) automatic judge evaluation.
 *
 * The class is stateless: each `run()` call sends the prompt directly to the
 * underlying `Runner` and returns a `ManagedResult`. Conversation history,
 * if any, must be managed by the caller (or by the Runner implementation).
 *
 * Obtain an instance via `LDAIClient.createModel()`.
 */
export class ManagedModel {
  constructor(
    protected readonly aiConfig: LDAICompletionConfig,
    protected readonly runner: Runner,
    private readonly _logger?: LDLogger,
  ) {}

  /**
   * Invoke the model with a prompt string and return a ManagedResult.
   *
   * `run()` resolves before `ManagedResult.evaluations` resolves. Awaiting
   * `evaluations` guarantees both judge evaluation and tracker.trackJudgeResult()
   * are complete.
   *
   * @param prompt The user input to send to the model.
   * @returns Promise resolving to ManagedResult (before evaluations settle).
   */
  async run(prompt: string): Promise<ManagedResult> {
    const tracker = this.aiConfig.createTracker!();

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

    // Evaluations are wired in a follow-up PR. For now, resolve empty.
    const evaluations: Promise<LDJudgeResult[]> = Promise.resolve([]);

    return {
      content: result.content,
      metrics,
      raw: result.raw,
      parsed: result.parsed,
      evaluations,
    };
  }

  /**
   * Get the underlying AI configuration used to initialize this ManagedModel.
   */
  getConfig(): LDAICompletionConfig {
    return this.aiConfig;
  }
}
