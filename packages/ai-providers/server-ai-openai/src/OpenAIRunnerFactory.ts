import { OpenAI } from 'openai';

import { AIProvider } from '@launchdarkly/server-sdk-ai';
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
export class OpenAIRunnerFactory extends AIProvider {
  private _client: OpenAI;

  constructor(logger?: LDLogger) {
    super(logger);
    this._client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // Fire-and-forget: OTel instrumentation is optional and must not block construction.
    OpenAIRunnerFactory._ensureInstrumented(logger).catch(() => {});
  }

  /**
   * Create a model runner from a completion AI configuration.
   */
  async createModel(config: LDAICompletionConfig): Promise<OpenAIModelRunner> {
    return new OpenAIModelRunner(this._client, config, this.logger);
  }

  /**
   * Create an agent runner from an agent AI configuration.
   *
   * The returned runner uses the OpenAI Agents SDK (`@openai/agents`) which
   * manages its own OpenAI client internally.
   *
   * @param config The LaunchDarkly AI agent configuration. Tool definitions
   *   are sourced from `config.model.parameters.tools` (consistent with the
   *   completion path).
   * @param tools Registry mapping tool names to their callable implementations
   *   or pre-built openai-agents tool instances. Tool names referenced by the
   *   model that are not present here will be logged and skipped.
   */
  async createAgent(config: LDAIAgentConfig, tools?: ToolRegistry): Promise<OpenAIAgentRunner> {
    return new OpenAIAgentRunner(config, tools ?? {}, this.logger);
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
