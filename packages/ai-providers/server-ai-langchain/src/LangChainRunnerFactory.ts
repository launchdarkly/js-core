import { createAgent } from 'langchain';

import { AIProvider } from '@launchdarkly/server-sdk-ai';
import type {
  LDAIAgentConfig,
  LDAICompletionConfig,
  LDAIConfig,
  LDLogger,
} from '@launchdarkly/server-sdk-ai';

import { LangChainAgentRunner, ToolRegistry } from './LangChainAgentRunner';
import { buildStructuredTools, createLangChainModel } from './LangChainHelper';
import { LangChainModelRunner } from './LangChainModelRunner';

let instrumentPromise: Promise<void> | undefined;

/**
 * Factory for creating LangChain runners (chat completion and agent).
 */
export class LangChainRunnerFactory extends AIProvider {
  constructor(logger?: LDLogger) {
    super(logger);
    LangChainRunnerFactory._ensureInstrumented(logger).catch(() => {});
  }

  /**
   * Create a model runner from a completion AI configuration.
   */
  async createModel(config: LDAICompletionConfig): Promise<LangChainModelRunner> {
    const llm = await createLangChainModel(config);
    return new LangChainModelRunner(llm, config, this.logger);
  }

  /**
   * Create an agent runner from an agent AI configuration.
   *
   * Uses LangChain's `createAgent` to build a compiled agent graph that
   * handles the tool-calling loop internally. Tool definitions are sourced
   * from `config.model.parameters.tools` and matched against the supplied
   * `tools` registry.
   */
  async createAgent(config: LDAIAgentConfig, tools?: ToolRegistry): Promise<LangChainAgentRunner> {
    const parameters = { ...(config.model?.parameters || {}) };
    const toolDefinitions = (parameters.tools as any[] | undefined) ?? [];
    delete parameters.tools;

    const configForModel: LDAIConfig = {
      ...config,
      model: { ...(config.model ?? { name: '' }), parameters },
    };
    const llm = await createLangChainModel(configForModel);

    const lcTools = buildStructuredTools(toolDefinitions, tools ?? {}, this.logger);
    const instructions = config.instructions ?? '';

    const agent = createAgent({
      model: llm,
      tools: lcTools.length > 0 ? lcTools : undefined,
      systemPrompt: instructions || undefined,
    });

    return new LangChainAgentRunner(agent as any, this.logger);
  }

  /**
   * Automatically patches the ESM LangChain module for OpenTelemetry tracing
   * when a TracerProvider is active and @traceloop/instrumentation-langchain
   * is installed.
   */
  private static async _ensureInstrumented(logger?: LDLogger): Promise<void> {
    if (instrumentPromise !== undefined) {
      return instrumentPromise;
    }

    instrumentPromise = (async () => {
      try {
        const { LangChainInstrumentation } = await import('@traceloop/instrumentation-langchain');
        const callbackManagerModule = await import('@langchain/core/callbacks/manager');
        const instrumentation = new LangChainInstrumentation();
        instrumentation.manuallyInstrument({ callbackManagerModule });
        logger?.info('LangChain ESM module instrumented for OpenTelemetry tracing.');
      } catch {
        logger?.debug(
          'OpenTelemetry instrumentation not available for LangChain provider. ' +
            'Install @traceloop/instrumentation-langchain to enable automatic tracing.',
        );
      }
    })();

    return instrumentPromise;
  }
}
