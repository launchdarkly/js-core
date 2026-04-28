import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { initChatModel } from 'langchain/chat_models/universal';

import type {
  LDAIAgentConfig,
  LDAICompletionConfig,
  LDAIConfig,
  LDLogger,
} from '@launchdarkly/server-sdk-ai';

import { LangChainAgentRunner, ToolRegistry } from './LangChainAgentRunner';
import { mapProviderName } from './langchainHelper';
import { LangChainModelRunner } from './LangChainModelRunner';

let instrumentPromise: Promise<void> | undefined;

/**
 * Factory for creating LangChain runners (chat completion and agent).
 */
export class LangChainRunnerFactory {
  private _logger?: LDLogger;

  constructor(logger?: LDLogger) {
    this._logger = logger;
  }

  /**
   * Static convenience that ensures OpenTelemetry instrumentation is applied
   * (when available) before constructing a factory.
   */
  static async create(logger?: LDLogger): Promise<LangChainRunnerFactory> {
    // eslint-disable-next-line no-underscore-dangle
    await LangChainRunnerFactory._ensureInstrumented(logger);
    return new LangChainRunnerFactory(logger);
  }

  /**
   * Create a model runner from a completion AI configuration.
   */
  async createModel(config: LDAICompletionConfig): Promise<LangChainModelRunner> {
    const llm = await LangChainRunnerFactory.createLangChainModel(config);
    return new LangChainModelRunner(llm, this._logger);
  }

  /**
   * Create an agent runner from an agent AI configuration.
   *
   * Tool definitions are sourced from `config.model.parameters.tools`. Tool
   * names referenced by the model that are not present in `tools` will be
   * logged and return an empty result.
   */
  async createAgent(config: LDAIAgentConfig, tools?: ToolRegistry): Promise<LangChainAgentRunner> {
    const parameters = { ...(config.model?.parameters || {}) };
    const toolDefinitions = (parameters.tools as any[] | undefined) ?? [];
    delete parameters.tools;

    const configForModel: LDAIConfig = {
      ...config,
      model: { ...(config.model ?? { name: '' }), parameters },
    };
    const llm = await LangChainRunnerFactory.createLangChainModel(configForModel);
    const instructions = config.instructions ?? '';

    return new LangChainAgentRunner(llm, instructions, toolDefinitions, tools ?? {}, this._logger);
  }

  /**
   * Create a LangChain model from an AI configuration.
   */
  static async createLangChainModel(aiConfig: LDAIConfig): Promise<BaseChatModel> {
    const modelName = aiConfig.model?.name || '';
    const provider = aiConfig.provider?.name || '';
    const parameters = aiConfig.model?.parameters || {};

    return initChatModel(modelName, {
      ...parameters,
      modelProvider: mapProviderName(provider),
    });
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
