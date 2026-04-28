import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';

import type { LDLogger, LDMessage, Runner, RunnerResult } from '@launchdarkly/server-sdk-ai';

import { convertMessagesToLangChain, getAIMetricsFromResponse } from './langchainHelper';

/**
 * Runner implementation for LangChain chat models.
 *
 * Implements the unified `Runner` protocol via {@link run}. Returned by
 * {@link LangChainRunnerFactory.createModel}.
 */
export class LangChainModelRunner implements Runner {
  private _llm: BaseChatModel;
  private _logger?: LDLogger;

  constructor(llm: BaseChatModel, logger?: LDLogger) {
    this._llm = llm;
    this._logger = logger;
  }

  /**
   * Run the LangChain model with the given messages.
   *
   * @param input Array of LDMessage objects
   * @param outputType Optional JSON schema for structured output. When provided,
   *   the parsed result is exposed via {@link RunnerResult.parsed}.
   */
  async run(input: LDMessage[], outputType?: Record<string, unknown>): Promise<RunnerResult> {
    if (outputType !== undefined) {
      return this._runStructured(input, outputType);
    }
    return this._runCompletion(input);
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

      // LangChain's structured output path discards token usage data.
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
