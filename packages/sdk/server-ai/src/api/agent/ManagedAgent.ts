import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { ChatResponse } from '../chat/types';
import { LDAIAgentConfig } from '../config/types';
import { LDJudgeResult } from '../judge/types';
import { LDAIMetricSummary, ManagedResult } from '../model/types';
import { AIProvider } from '../providers/AIProvider';

/**
 * ManagedAgent provides agent invocation with automatic judge evaluation.
 *
 * This is the agent-mode analogue of TrackedChat (ManagedModel). It invokes
 * the provider, tracks metrics, and wires judge evaluations into a single
 * Promise exposed on ManagedResult.evaluations.
 *
 * Obtain an instance via `LDAIClient.createAgent()`.
 */
export class ManagedAgent {
  constructor(
    protected readonly aiAgentConfig: LDAIAgentConfig,
    protected readonly provider: AIProvider,
    private readonly _logger?: LDLogger,
  ) {}

  /**
   * Invoke the agent with a prompt string and return a ManagedResult.
   *
   * run() returns before ManagedResult.evaluations resolves. Awaiting evaluations
   * guarantees both evaluation and tracker.trackJudgeResult() are complete.
   *
   * @param prompt The user input to send to the agent.
   * @returns Promise resolving to ManagedResult (before evaluations settle).
   */
  async run(prompt: string): Promise<ManagedResult> {
    const tracker = this.aiAgentConfig.createTracker!();

    const userMessage = { role: 'user' as const, content: prompt };
    const allMessages = [userMessage];

    // Delegate to provider-specific implementation with tracking
    const response = await tracker.trackMetricsOf(
      (result: ChatResponse) => result.metrics,
      () => this.provider.invokeModel(allMessages),
    );

    // Build the metric summary from response metrics + resumption token
    const metrics: LDAIMetricSummary = {
      success: response.metrics.success,
      usage: response.metrics.usage,
      toolCalls: response.metrics.toolCalls,
      durationMs: response.metrics.durationMs,
      resumptionToken: tracker.resumptionToken,
    };

    const output = response.message.content;

    // Wire evaluation + tracking into a single Promise.
    // run() returns before this resolves — awaiting evaluations guarantees
    // both evaluation and tracking are complete.
    const evaluator = this.aiAgentConfig.evaluator;
    let evaluations: Promise<LDJudgeResult[]>;
    if (evaluator && evaluator.judgeConfiguration.judges.length > 0) {
      evaluations = evaluator.evaluate(prompt, output).then((results) => {
        results.forEach((judgeResult) => {
          tracker.trackJudgeResult(judgeResult);
        });
        return results;
      });
    } else {
      evaluations = Promise.resolve([]);
    }

    return {
      content: output,
      metrics,
      evaluations,
    };
  }

  /**
   * Get the underlying AI agent configuration.
   */
  getConfig(): LDAIAgentConfig {
    return this.aiAgentConfig;
  }

  /**
   * Get the underlying AI provider instance.
   */
  getProvider(): AIProvider {
    return this.provider;
  }
}
