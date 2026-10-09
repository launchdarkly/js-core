import { OpenAI } from 'openai';

import type {
  LDAICompletionConfig,
  LDLogger,
  LDMessage,
  Runner,
  RunnerResult,
} from '@launchdarkly/server-sdk-ai';

import { convertMessagesToOpenAI, getAIMetricsFromResponse } from './OpenAIHelper';

/**
 * Runner implementation for OpenAI chat completions.
 *
 * Implements the unified `Runner` protocol via {@link run}. Returned by
 * {@link OpenAIRunnerFactory.createModel}.
 */
export class OpenAIModelRunner implements Runner {
  private _client: OpenAI;
  private _modelName: string;
  private _parameters: Record<string, unknown>;
  private _history: LDMessage[];
  private _multiTurn: boolean;
  private _logger?: LDLogger;

  constructor(
    client: OpenAI,
    config: LDAICompletionConfig,
    logger?: LDLogger,
    multiTurn: boolean = true,
  ) {
    this._client = client;
    this._modelName = config.model?.name ?? '';
    this._parameters = { ...(config.model?.parameters ?? {}) };
    this._history = [...(config.messages ?? [])];
    this._multiTurn = multiTurn;
    this._logger = logger;
  }

  /**
   * Run the OpenAI model with the given user prompt or message array.
   *
   * When `input` is a string, the runner maintains a conversation history
   * initialized from any messages on the AI config. The user prompt is
   * appended to the existing history before being sent to the model. When
   * `multiTurn` is `true` (the default) and the call succeeds with non-empty
   * content, the user prompt and the assistant's reply are persisted to the
   * history so subsequent calls continue the conversation. When `multiTurn`
   * is `false`, history is treated as read-only — useful for stateless runners
   * (e.g. judges) where every call should see only the initial config messages
   * plus the current input. Failed calls leave the history unchanged so the
   * next call can retry cleanly.
   *
   * When `input` is a pre-built `LDMessage[]` it is used as-is — config
   * messages are not prepended and history is not updated.
   *
   * @param input The user prompt string, or a pre-built message array.
   * @param outputType Optional JSON schema for structured output. When provided,
   *   the response is parsed and exposed via {@link RunnerResult.parsed}.
   */
  async run(input: string | LDMessage[], outputType?: Record<string, unknown>): Promise<RunnerResult> {
    if (Array.isArray(input)) {
      return outputType !== undefined
        ? this._runStructured(input, outputType)
        : this._runCompletion(input);
    }

    const userMessage: LDMessage = { role: 'user', content: input };
    const messages: LDMessage[] = [...this._history, userMessage];

    const result =
      outputType !== undefined
        ? await this._runStructured(messages, outputType)
        : await this._runCompletion(messages);

    if (result.metrics.success && result.content && this._multiTurn) {
      this._history.push(userMessage);
      this._history.push({ role: 'assistant', content: result.content });
    }

    return result;
  }

  /**
   * Get the underlying OpenAI client instance.
   */
  getClient(): OpenAI {
    return this._client;
  }

  private async _runCompletion(messages: LDMessage[]): Promise<RunnerResult> {
    try {
      const response = await this._client.chat.completions.create({
        ...this._parameters,
        model: this._modelName,
        messages: convertMessagesToOpenAI(messages),
      });

      const metrics = getAIMetricsFromResponse(response);
      const content = response?.choices?.[0]?.message?.content || '';

      if (!content) {
        this._logger?.warn('OpenAI response has no content available');
        metrics.success = false;
      }

      return { content, metrics, raw: response };
    } catch (error) {
      this._logger?.warn('OpenAI model invocation failed:', error);
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
    let response;
    try {
      response = await this._client.chat.completions.create({
        ...this._parameters,
        model: this._modelName,
        messages: convertMessagesToOpenAI(messages),
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'structured_output',
            schema: outputType,
            strict: true,
          },
        },
      });
    } catch (error) {
      this._logger?.warn('OpenAI structured model invocation failed:', error);
      return {
        content: '',
        metrics: { success: false },
      };
    }

    const metrics = getAIMetricsFromResponse(response);
    const content = response?.choices?.[0]?.message?.content || '';

    if (!content) {
      this._logger?.warn('OpenAI structured response has no content available');
      metrics.success = false;
      return { content: '', metrics, raw: response };
    }

    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      return { content, metrics, raw: response, parsed };
    } catch (parseError) {
      this._logger?.warn('OpenAI structured response contains invalid JSON:', parseError);
      metrics.success = false;
      return { content, metrics, raw: response };
    }
  }
}
