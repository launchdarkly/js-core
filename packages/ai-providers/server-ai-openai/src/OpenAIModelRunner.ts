import { OpenAI } from 'openai';

import type { LDLogger, LDMessage, Runner, RunnerResult } from '@launchdarkly/server-sdk-ai';

import { convertMessagesToOpenAI, getAIMetricsFromResponse } from './openaiHelper';

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
  private _logger?: LDLogger;

  constructor(
    client: OpenAI,
    modelName: string,
    parameters: Record<string, unknown>,
    logger?: LDLogger,
  ) {
    this._client = client;
    this._modelName = modelName;
    this._parameters = parameters;
    this._logger = logger;
  }

  /**
   * Run the OpenAI model with the given messages.
   *
   * @param input Array of LDMessage objects
   * @param outputType Optional JSON schema for structured output. When provided,
   *   the response is parsed and exposed via {@link RunnerResult.parsed}.
   */
  async run(input: LDMessage[], outputType?: Record<string, unknown>): Promise<RunnerResult> {
    if (outputType !== undefined) {
      return this._runStructured(input, outputType);
    }
    return this._runCompletion(input);
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
