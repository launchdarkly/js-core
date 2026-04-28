import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { LDAICompletionConfig, LDMessage } from '../config/types';
import { Judge } from '../judge/Judge';
import { LDJudgeResult } from '../judge/types';
import { LDAIMetricSummary, ManagedResult } from '../model/types';
import { AIProvider } from '../providers/AIProvider';
import { ChatResponse } from './types';

/**
 * Concrete implementation of TrackedChat that provides chat functionality
 * by delegating to an AIProvider implementation.
 * This class handles conversation management and tracking, while delegating
 * the actual model invocation to the provider.
 *
 * Use `run()` as the primary entry point. `invoke()` is deprecated.
 */
export class TrackedChat {
  protected messages: LDMessage[];

  constructor(
    protected readonly aiConfig: LDAICompletionConfig,
    protected readonly provider: AIProvider,
    protected readonly judges: Record<string, Judge> = {},
    private readonly _logger?: LDLogger,
  ) {
    this.messages = [];
  }

  /**
   * Invoke the chat model with a prompt string and return a ManagedResult.
   * This is the primary entry point for model invocation. Judge evaluations are
   * wired asynchronously and exposed via ManagedResult.evaluations.
   *
   * run() returns before ManagedResult.evaluations resolves. Awaiting evaluations
   * guarantees both evaluation and tracking (tracker.trackJudgeResult) are complete.
   */
  async run(prompt: string): Promise<ManagedResult> {
    const tracker = this.aiConfig.createTracker!();

    // Convert prompt string to LDMessage with role 'user' and add to conversation history
    const userMessage: LDMessage = {
      role: 'user',
      content: prompt,
    };
    this.messages.push(userMessage);

    // Prepend config messages to conversation history for model invocation
    const configMessages = this.aiConfig.messages || [];
    const allMessages = [...configMessages, ...this.messages];

    // Delegate to provider-specific implementation with tracking
    const response = await tracker.trackMetricsOf(
      (result: ChatResponse) => result.metrics,
      () => this.provider.invokeModel(allMessages),
    );

    this.messages.push(response.message);

    // Build the metric summary from response metrics + resumption token
    const metrics: LDAIMetricSummary = {
      success: response.metrics.success,
      usage: response.metrics.usage,
      toolCalls: response.metrics.toolCalls,
      durationMs: response.metrics.durationMs,
      resumptionToken: tracker.resumptionToken,
    };

    const output = response.message.content;
    // Build a single string of the input messages for judge evaluation
    const inputText = this.messages
      .slice(0, -1) // exclude the just-added assistant response
      .map((m) => m.content)
      .join('\r\n');

    // Wire evaluation + tracking into a single Promise.
    // run() returns before this resolves — awaiting evaluations guarantees
    // both evaluation and tracking are complete.
    const evaluator = this.aiConfig.evaluator;
    let evaluations: Promise<LDJudgeResult[]>;
    if (evaluator && evaluator.judgeConfiguration.judges.length > 0) {
      evaluations = evaluator.evaluate(inputText, output).then((results) => {
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
   * Invoke the chat model with a prompt string.
   * This method handles conversation management and tracking, delegating to the provider's invokeModel method.
   * @deprecated Use `run()` instead.
   */
  async invoke(prompt: string): Promise<ChatResponse> {
    const tracker = this.aiConfig.createTracker!();

    // Convert prompt string to LDMessage with role 'user' and add to conversation history
    const userMessage: LDMessage = {
      role: 'user',
      content: prompt,
    };
    this.messages.push(userMessage);

    // Prepend config messages to conversation history for model invocation
    const configMessages = this.aiConfig.messages || [];
    const allMessages = [...configMessages, ...this.messages];

    // Delegate to provider-specific implementation with tracking
    const response = await tracker.trackMetricsOf(
      (result: ChatResponse) => result.metrics,
      () => this.provider.invokeModel(allMessages),
    );

    this.messages.push(response.message);
    return response;
  }

  /**
   * Get the underlying AI configuration used to initialize this TrackedChat.
   */
  getConfig(): LDAICompletionConfig {
    return this.aiConfig;
  }

  /**
   * Get the underlying AI provider instance.
   * This provides direct access to the provider for advanced use cases.
   */
  getProvider(): AIProvider {
    return this.provider;
  }

  /**
   * Get the judges associated with this TrackedChat.
   * Returns a record of judge instances keyed by their configuration keys.
   */
  getJudges(): Record<string, Judge> {
    return this.judges;
  }

  /**
   * Append messages to the conversation history.
   * Adds messages to the conversation history without invoking the model,
   * which is useful for managing multi-turn conversations or injecting context.
   *
   * @param messages Array of messages to append to the conversation history
   */
  appendMessages(messages: LDMessage[]): void {
    this.messages.push(...messages);
  }

  /**
   * Get all messages in the conversation history.
   *
   * @param includeConfigMessages Whether to include the config messages from the AIConfig.
   *                              Defaults to false.
   * @returns Array of messages. When includeConfigMessages is true, returns both config
   *          messages and conversation history with config messages prepended. When false,
   *          returns only the conversation history messages.
   */
  getMessages(includeConfigMessages: boolean = false): LDMessage[] {
    if (includeConfigMessages) {
      const configMessages = this.aiConfig.messages || [];
      return [...configMessages, ...this.messages];
    }
    return [...this.messages];
  }
}
