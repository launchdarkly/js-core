import { generateObject, generateText, jsonSchema, LanguageModel, ModelMessage } from 'ai';

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
  private _parameters: VercelAIModelParameters;
  private _history: ModelMessage[];
  private _multiTurn: boolean;
  private _logger?: LDLogger;

  constructor(
    model: LanguageModel,
    config: LDAICompletionConfig,
    parameters: VercelAIModelParameters,
    logger?: LDLogger,
    multiTurn: boolean = true,
  ) {
    this._model = model;
    this._parameters = parameters;
    this._history = convertMessagesToVercel(config.messages ?? []) as ModelMessage[];
    this._multiTurn = multiTurn;
    this._logger = logger;
  }

  /**
   * Run the Vercel AI model with the given user prompt or message array.
   *
   * When `input` is a string, the runner maintains a conversation history (as
   * Vercel AI SDK `ModelMessage`s) initialized from any messages on the AI
   * config. The user prompt is appended to the existing history before being
   * sent to the model. When `multiTurn` is `true` (the default) and the call
   * succeeds with non-empty content, the user prompt and the assistant's reply
   * are persisted to the history so subsequent calls continue the
   * conversation. When `multiTurn` is `false`, history is treated as
   * read-only — useful for stateless runners (e.g. judges) where every call
   * should see only the initial config messages plus the current input. Failed
   * calls leave the history unchanged so the next call can retry cleanly.
   *
   * When `input` is a pre-built `LDMessage[]` it is used as-is — config
   * messages are not prepended and history is not updated.
   *
   * @param input The user prompt string, or a pre-built message array.
   * @param outputType Optional JSON schema for structured output. When provided,
   *   the parsed object is exposed via {@link RunnerResult.parsed}.
   */
  async run(input: string | LDMessage[], outputType?: Record<string, unknown>): Promise<RunnerResult> {
    if (Array.isArray(input)) {
      const vercelMessages = convertMessagesToVercel(input) as ModelMessage[];
      return outputType !== undefined
        ? this._runStructured(vercelMessages, outputType)
        : this._runCompletion(vercelMessages);
    }

    const userMessage: ModelMessage = { role: 'user', content: input };
    const messages: ModelMessage[] = [...this._history, userMessage];

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
   * Get the underlying Vercel AI model instance.
   */
  getModel(): LanguageModel {
    return this._model;
  }

  private async _runCompletion(messages: ModelMessage[]): Promise<RunnerResult> {
    try {
      const result = await generateText({
        ...this._parameters,
        model: this._model,
        messages,
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
    messages: ModelMessage[],
    outputType: Record<string, unknown>,
  ): Promise<RunnerResult> {
    try {
      const result = await generateObject({
        ...this._parameters,
        model: this._model,
        messages,
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
