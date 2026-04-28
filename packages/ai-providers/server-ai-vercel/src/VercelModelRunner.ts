import { generateObject, generateText, jsonSchema, LanguageModel } from 'ai';

import type { LDLogger, LDMessage, Runner, RunnerResult } from '@launchdarkly/server-sdk-ai';

import type { VercelAIModelParameters } from './types';
import { convertMessagesToVercel, getAIMetricsFromResponse } from './vercelHelper';

/**
 * Runner implementation for Vercel AI SDK chat models.
 *
 * Implements the unified `Runner` protocol via {@link run}. Returned by
 * {@link VercelRunnerFactory.createModel}.
 */
export class VercelModelRunner implements Runner {
  private _model: LanguageModel;
  private _parameters: VercelAIModelParameters;
  private _logger?: LDLogger;

  constructor(model: LanguageModel, parameters: VercelAIModelParameters, logger?: LDLogger) {
    this._model = model;
    this._parameters = parameters;
    this._logger = logger;
  }

  /**
   * Run the Vercel AI model with the given messages.
   *
   * @param input Array of LDMessage objects
   * @param outputType Optional JSON schema for structured output. When provided,
   *   the parsed object is exposed via {@link RunnerResult.parsed}.
   */
  async run(input: LDMessage[], outputType?: Record<string, unknown>): Promise<RunnerResult> {
    if (outputType !== undefined) {
      return this._runStructured(input, outputType);
    }
    return this._runCompletion(input);
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
