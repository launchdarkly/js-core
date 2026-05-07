import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';

import type {
  LDAICompletionConfig,
  LDLogger,
  LDMessage,
  Runner,
  RunnerResult,
} from '@launchdarkly/server-sdk-ai';

import { convertMessagesToLangChain, getAIMetricsFromResponse } from './LangChainHelper';

/**
 * Runner implementation for LangChain chat models.
 *
 * Implements the unified `Runner` protocol via {@link run}. Returned by
 * {@link LangChainRunnerFactory.createModel}.
 */
export class LangChainModelRunner implements Runner {
  private _llm: BaseChatModel;
  private _config: LDAICompletionConfig;
  private _logger?: LDLogger;

  constructor(llm: BaseChatModel, config: LDAICompletionConfig, logger?: LDLogger) {
    this._llm = llm;
    this._config = config;
    this._logger = logger;
  }

  /**
   * Run the LangChain model with the given user prompt.
   *
   * Prepends any messages defined in the AI config (system prompt, etc.) before
   * the user prompt.
   *
   * @param input The user prompt string.
   * @param outputType Optional JSON schema for structured output. When provided,
   *   the parsed result is exposed via {@link RunnerResult.parsed}.
   */
  async run(input: string, outputType?: Record<string, unknown>): Promise<RunnerResult> {
    const messages: LDMessage[] = [
      ...(this._config.messages ?? []),
      { role: 'user', content: input },
    ];

    if (outputType !== undefined) {
      return this._runStructured(messages, outputType);
    }
    return this._runCompletion(messages);
  }

  /**
   * Get the underlying LangChain model instance.
   */
  getChatModel(): BaseChatModel {
    return this._llm;
  }

  private async _runCompletion(messages: LDMessage[]): Promise<RunnerResult> {
    try {
      const langchainMessages = convertMessagesToLangChain(messages);
      const response: AIMessage = await this._llm.invoke(langchainMessages);
      const metrics = getAIMetricsFromResponse(response);

      let content: string = '';
      if (typeof response.content === 'string') {
        content = response.content;
      } else {
        this._logger?.warn(
          `Multimodal response not supported, expecting a string. Content type: ${typeof response.content}, Content:`,
          JSON.stringify(response.content, null, 2),
        );
        metrics.success = false;
      }

      return { content, metrics, raw: response };
    } catch (error) {
      this._logger?.warn('LangChain model invocation failed:', error);
      return {
        content: '',
        metrics: { success: false },
      };
    }
  }

  private async _runStructured(
    messages: LDMessage[],
    outputType: Record<string, unknown>,
  ): Promise<RunnerResult> {
    try {
      const langchainMessages = convertMessagesToLangChain(messages);
      const response = (await this._llm
        .withStructuredOutput(outputType)
        .invoke(langchainMessages)) as Record<string, unknown>;

      const metrics = {
        success: true,
        usage: { total: 0, input: 0, output: 0 },
      };

      return {
        content: JSON.stringify(response),
        metrics,
        raw: response,
        parsed: response,
      };
    } catch (error) {
      this._logger?.warn('LangChain structured model invocation failed:', error);
      return {
        content: '',
        metrics: {
          success: false,
          usage: { total: 0, input: 0, output: 0 },
        },
      };
    }
  }
}
