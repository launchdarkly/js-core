import { generateObject, generateText, jsonSchema, LanguageModel } from 'ai';

import type {
  LDAICompletionConfig,
  LDLogger,
  LDMessage,
  Runner,
  RunnerResult,
} from '@launchdarkly/server-sdk-ai';

import type { VercelAIModelParameters } from './types';
import { convertMessagesToVercel, getAIMetricsFromResponse } from './VercelHelper';

/**
 * Runner implementation for Vercel AI SDK chat models.
 *
 * Implements the unified `Runner` protocol via {@link run}. Returned by
 * {@link VercelRunnerFactory.createModel}.
 */
export class VercelModelRunner implements Runner {
  private _model: LanguageModel;
  private _config: LDAICompletionConfig;
  private _parameters: VercelAIModelParameters;
  private _logger?: LDLogger;

  constructor(
    model: LanguageModel,
    config: LDAICompletionConfig,
    parameters: VercelAIModelParameters,
    logger?: LDLogger,
  ) {
    this._model = model;
    this._config = config;
    this._parameters = parameters;
    this._logger = logger;
  }

  /**
   * Run the Vercel AI model with the given prompt.
   *
   * @param input The user prompt string, or a pre-built message array. When a
   *   string is supplied the config's system messages are prepended automatically.
   *   When a `LDMessage[]` is supplied it is used as-is (config messages are NOT
   *   prepended — the caller is responsible for the full message list).
   * @param outputType Optional JSON schema for structured output. When provided,
   *   the parsed object is exposed via {@link RunnerResult.parsed}.
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
   * Get the underlying Vercel AI model instance.
   */
  getModel(): LanguageModel {
    return this._model;
  }

  private async _runCompletion(messages: LDMessage[]): Promise<RunnerResult> {
    try {
      const result = await generateText({
        ...this._parameters,
        model: this._model,
        messages: convertMessagesToVercel(messages),
        experimental_telemetry: { isEnabled: true },
      });

      const metrics = getAIMetricsFromResponse(result);
      return { content: result.text, metrics, raw: result };
    } catch (error) {
      this._logger?.warn('Vercel AI model invocation failed:', error);
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
      const result = await generateObject({
        ...this._parameters,
        model: this._model,
        messages: convertMessagesToVercel(messages),
        schema: jsonSchema(outputType),
        experimental_telemetry: { isEnabled: true },
      });

      const metrics = getAIMetricsFromResponse(result);
      const parsed = result.object as Record<string, unknown>;

      return {
        content: JSON.stringify(parsed),
        metrics,
        raw: result,
        parsed,
      };
    } catch (error) {
      this._logger?.warn('Vercel AI structured model invocation failed:', error);
      return {
        content: '',
        metrics: { success: false },
      };
    }
  }
}
