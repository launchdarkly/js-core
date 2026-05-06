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
  private _config: LDAICompletionConfig;
  private _modelName: string;
  private _parameters: Record<string, unknown>;
  private _logger?: LDLogger;

  constructor(client: OpenAI, config: LDAICompletionConfig, logger?: LDLogger) {
    this._client = client;
    this._config = config;
    this._modelName = config.model?.name ?? '';
    this._parameters = { ...(config.model?.parameters ?? {}) };
    this._logger = logger;
  }

  /**
   * Run the OpenAI model with the given prompt or message array.
   *
   * When `input` is a string it is wrapped as a user turn and appended to any
   * messages defined in the config. When `input` is already a `LDMessage[]`
   * (e.g. when called from the Judge evaluation path) it is used as-is.
   *
   * @param input The user prompt string, or a pre-built message array.
   * @param outputType Optional JSON schema for structured output. When provided,
   *   the response is parsed and exposed via {@link RunnerResult.parsed}.
   */
  async run(input: string | LDMessage[], outputType?: Record<string, unknown>): Promise<RunnerResult> {
    const messages: LDMessage[] = Array.isArray(input)
      ? input
      : [...(this._config.messages ?? []), { role: 'user', content: input }];

    if (outputType !== undefined) {
      return this._runStructured(messages, outputType);
    }
    return this._runCompletion(messages);
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
