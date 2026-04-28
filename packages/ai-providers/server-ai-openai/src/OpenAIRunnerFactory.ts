import { OpenAI } from 'openai';

import type { LDAIAgentConfig, LDAICompletionConfig, LDLogger } from '@launchdarkly/server-sdk-ai';

import { OpenAIAgentRunner, ToolRegistry } from './OpenAIAgentRunner';
import { OpenAIModelRunner } from './OpenAIModelRunner';

let instrumentPromise: Promise<void> | undefined;

/**
 * Factory for creating OpenAI runners (chat completion and agent).
 *
 * A single factory shares one `OpenAI` client across all runners it produces
 * so connection pooling and instrumentation are preserved.
 */
export class OpenAIRunnerFactory {
  private _client: OpenAI;
  private _logger?: LDLogger;

  constructor(client?: OpenAI, logger?: LDLogger) {
    this._client = client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this._logger = logger;
  }

  /**
   * Static convenience that ensures OpenTelemetry instrumentation is applied
   * (when available) before constructing a factory.
   */
  static async create(logger?: LDLogger): Promise<OpenAIRunnerFactory> {
    // eslint-disable-next-line no-underscore-dangle
    await OpenAIRunnerFactory._ensureInstrumented(logger);
    return new OpenAIRunnerFactory(undefined, logger);
  }

  /**
   * Create a model runner from a completion AI configuration.
   */
  createModel(config: LDAICompletionConfig): OpenAIModelRunner {
    const modelName = config.model?.name || '';
    const parameters = { ...(config.model?.parameters || {}) };
    return new OpenAIModelRunner(this._client, modelName, parameters, this._logger);
  }

  /**
   * Create an agent runner from an agent AI configuration.
   *
   * @param config The LaunchDarkly AI agent configuration. Tool definitions
   *   are sourced from `config.model.parameters.tools` (consistent with the
   *   completion path).
   * @param tools Registry mapping tool names to their callable implementations.
   *   Tool names referenced by the model that are not present here will be
   *   logged and return an empty result.
   */
  createAgent(config: LDAIAgentConfig, tools?: ToolRegistry): OpenAIAgentRunner {
    const modelName = config.model?.name || '';
    const parameters: Record<string, unknown> = { ...(config.model?.parameters || {}) };
    const toolDefinitions = (parameters.tools as any[] | undefined) ?? [];
    delete parameters.tools;
    const instructions = config.instructions ?? '';

    return new OpenAIAgentRunner(
      this._client,
      modelName,
      parameters,
      instructions,
      toolDefinitions,
      tools ?? {},
      this._logger,
    );
  }

  /**
   * Get the underlying OpenAI client instance.
   */
  getClient(): OpenAI {
    return this._client;
  }

  /**
   * Automatically patches the ESM openai module for OpenTelemetry tracing when
   * a TracerProvider is active and @traceloop/instrumentation-openai is installed.
   */
  private static async _ensureInstrumented(logger?: LDLogger): Promise<void> {
    if (instrumentPromise !== undefined) {
      return instrumentPromise;
    }

    instrumentPromise = (async () => {
      try {
        const { OpenAIInstrumentation } = await import('@traceloop/instrumentation-openai');
        const instrumentation = new OpenAIInstrumentation();
        instrumentation.manuallyInstrument(OpenAI);
        logger?.info('OpenAI ESM module instrumented for OpenTelemetry tracing.');
      } catch {
        logger?.debug(
          'OpenTelemetry instrumentation not available for OpenAI provider. ' +
            'Install @traceloop/instrumentation-openai to enable automatic tracing.',
        );
      }
    })();

    return instrumentPromise;
  }
}
