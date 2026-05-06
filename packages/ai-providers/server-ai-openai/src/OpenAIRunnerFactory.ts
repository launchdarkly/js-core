import { OpenAI } from 'openai';

import { AIProvider } from '@launchdarkly/server-sdk-ai';
import type { LDAIAgentConfig, LDAICompletionConfig, LDLogger } from '@launchdarkly/server-sdk-ai';

import { OpenAIAgentRunner, ToolRegistry } from './OpenAIAgentRunner';
import { _mapParameterKeys, buildAgentTools } from './OpenAIHelper';
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
   *   are sourced from `config.tools`.
   * @param tools Registry mapping tool names to their callable implementations
   *   or pre-built openai-agents tool instances. Tool names referenced by the
   *   config that are not present here will be logged and skipped.
   */
  async createAgent(config: LDAIAgentConfig, tools?: ToolRegistry): Promise<OpenAIAgentRunner> {
    let Agent: any;
    let agentRun: any;
    let toolHelper: any;
    try {
      const agents = await import('@openai/agents');
      Agent = agents.Agent;
      agentRun = agents.run;
      toolHelper = agents.tool;
    } catch (e) {
      throw new Error(
        `@openai/agents is required for OpenAIAgentRunner.\n` +
          `Install it with: npm install @openai/agents openai zod\n` +
          `Cause: ${e instanceof Error ? e.message : e}`,
      );
    }

    const registry = tools ?? {};
    const configTools = config.tools ?? {};
    const parameters = _mapParameterKeys({ ...(config.model?.parameters ?? {}) });
    delete parameters.tools;

    const { agentTools, toolNameMap } = buildAgentTools(toolHelper, configTools, registry, this.logger);
    const agent = new Agent({
      name: 'ldai-agent',
      instructions: config.instructions || undefined,
      model: config.model?.name ?? '',
      tools: agentTools,
      modelSettings: parameters,
    });

    return new OpenAIAgentRunner(agent, agentRun, toolNameMap, this.logger);
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
