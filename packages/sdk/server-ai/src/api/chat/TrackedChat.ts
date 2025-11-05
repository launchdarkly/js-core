import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { LDAIConfigTracker } from '../config/LDAIConfigTracker';
import { LDAICompletionConfig, LDMessage } from '../config/types';
import { Judge } from '../judge/Judge';
import { JudgeResponse } from '../judge/types';
import { AIProvider } from '../providers/AIProvider';
import { ChatResponse } from './types';

/**
 * Concrete implementation of TrackedChat that provides chat functionality
 * by delegating to an AIProvider implementation.
 * This class handles conversation management and tracking, while delegating
 * the actual model invocation to the provider.
 */
export class TrackedChat {
  protected messages: LDMessage[];

  constructor(
    protected readonly aiConfig: LDAICompletionConfig,
    protected readonly tracker: LDAIConfigTracker,
    protected readonly provider: AIProvider,
    protected readonly judges: Record<string, Judge> = {},
    private readonly _logger?: LDLogger,
  ) {
    this.messages = [];
  }

  /**
   * Invoke the chat model with a prompt string.
   * This method handles conversation management and tracking, delegating to the provider's invokeModel method.
   */
  async invoke(prompt: string): Promise<ChatResponse> {
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
    const response = await this.tracker.trackMetricsOf(
      (result: ChatResponse) => result.metrics,
      () => this.provider.invokeModel(allMessages),
    );

    // Add the assistant response to the conversation history
    this.messages.push(response.message);

    // Start judge evaluations if configured
    if (
      this.aiConfig.judgeConfiguration?.judges &&
      this.aiConfig.judgeConfiguration.judges.length > 0
    ) {
      response.evaluations = this._evaluateWithJudges(this.messages, response);
    }

    return response;
  }

  /**
   * Evaluates the response with all configured judges.
   * Returns a promise that resolves to an array of evaluation results.
   *
   * @param messages Array of messages representing the conversation history
   * @param response The AI response to be evaluated
   * @returns Promise resolving to array of judge evaluation results
   */
  private async _evaluateWithJudges(
    messages: LDMessage[],
    response: ChatResponse,
  ): Promise<Array<JudgeResponse | undefined>> {
    const judgeConfigs = this.aiConfig.judgeConfiguration!.judges;

    // Start all judge evaluations in parallel
    const evaluationPromises = judgeConfigs.map(async (judgeConfig) => {
      const judge = this.judges[judgeConfig.key];
      if (!judge) {
        this._logger?.warn(
          `Judge configuration is not enabled: ${judgeConfig.key}`,
          this.tracker.getTrackData(),
        );
        return undefined;
      }

      const evalResult = await judge.evaluateMessages(messages, response, judgeConfig.samplingRate);

      if (evalResult && evalResult.success) {
        this.tracker.trackEvalScores(evalResult.evals);
      }

      return evalResult;
    });

    // ensure all evaluations complete even if some fail
    const results = await Promise.allSettled(evaluationPromises);

    return results.map((result) => (result.status === 'fulfilled' ? result.value : undefined));
  }

  /**
   * Get the underlying AI configuration used to initialize this TrackedChat.
   */
  getConfig(): LDAICompletionConfig {
    return this.aiConfig;
  }

  /**
   * Get the underlying AI configuration tracker used to initialize this TrackedChat.
   */
  getTracker(): LDAIConfigTracker {
    return this.tracker;
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
