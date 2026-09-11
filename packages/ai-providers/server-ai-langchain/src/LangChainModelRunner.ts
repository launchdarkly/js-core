import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';

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
  private _chatHistory: InMemoryChatMessageHistory;
  private _multiTurn: boolean;
  private _logger?: LDLogger;

  constructor(
    llm: BaseChatModel,
    config: LDAICompletionConfig,
    logger?: LDLogger,
    multiTurn: boolean = true,
  ) {
    this._llm = llm;
    this._chatHistory = new InMemoryChatMessageHistory(
      convertMessagesToLangChain(config.messages ?? []),
    );
    this._multiTurn = multiTurn;
    this._logger = logger;
  }

  /**
   * Run the LangChain model with the given user prompt or message array.
   *
   * When `input` is a string, the runner maintains a LangChain
   * `InMemoryChatMessageHistory` initialized from any messages on the AI
   * config. The user prompt is appended to the existing history before being
   * sent to the model. When `multiTurn` is `true` (the default) and the call
   * succeeds with non-empty content, the user prompt and the assistant's reply
   * are persisted to the history so subsequent calls continue the
   * conversation. When `multiTurn` is `false`, history is treated as
   * read-only — useful for stateless runners (e.g. judges) where every call
   * should see only the initial config messages plus the current input.
   * Failed calls leave the history unchanged so the next call can retry
   * cleanly.
   *
   * When `input` is a pre-built `LDMessage[]` it is used as-is — config
   * messages are not prepended and history is not updated.
   *
   * @param input The user prompt string, or a pre-built message array.
   * @param outputType Optional JSON schema for structured output. When provided,
   *   the parsed result is exposed via {@link RunnerResult.parsed}.
   */
  async run(input: string | LDMessage[], outputType?: Record<string, unknown>): Promise<RunnerResult> {
    if (Array.isArray(input)) {
      const langchainMessages = convertMessagesToLangChain(input);
      return outputType !== undefined
        ? this._runStructured(langchainMessages, outputType)
        : this._runCompletion(langchainMessages);
    }

    const langchainMessages: BaseMessage[] = [
      ...(await this._chatHistory.getMessages()),
      new HumanMessage(input),
    ];

    const result =
      outputType !== undefined
        ? await this._runStructured(langchainMessages, outputType)
        : await this._runCompletion(langchainMessages);

    if (result.metrics.success && result.content && this._multiTurn) {
      await this._chatHistory.addUserMessage(input);
      await this._chatHistory.addAIMessage(result.content);
    }

    return result;
  }

  /**
   * Get the underlying LangChain model instance.
   */
  getChatModel(): BaseChatModel {
    return this._llm;
  }

  private async _runCompletion(messages: BaseMessage[]): Promise<RunnerResult> {
    try {
      const response: AIMessage = await this._llm.invoke(messages);
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
    messages: BaseMessage[],
    outputType: Record<string, unknown>,
  ): Promise<RunnerResult> {
    try {
      const response = (await this._llm
        .withStructuredOutput(outputType)
        .invoke(messages)) as Record<string, unknown>;

      const metrics = {
        success: true,
        tokens: { total: 0, input: 0, output: 0 },
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
          tokens: { total: 0, input: 0, output: 0 },
        },
      };
    }
  }
}
