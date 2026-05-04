import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { LDAIConfigKind } from '../config/types';
import { AgentGraphDefinition } from '../graph/AgentGraphDefinition';
import { AIProvider, ToolRegistry } from './AIProvider';
import { AgentGraphRunner, Runner } from './Runner';

/**
 * List of supported AI providers.
 */
export const SUPPORTED_AI_PROVIDERS = [
  'openai',
  // Multi-provider packages should be last in the list
  'langchain',
  'vercel',
] as const;

/**
 * Type representing the supported AI providers.
 */
export type SupportedAIProvider = (typeof SUPPORTED_AI_PROVIDERS)[number];

/**
 * Sole entry point for runner creation.
 *
 * RunnerFactory is the single factory for creating {@link Runner} and
 * {@link AgentGraphRunner} instances. It mirrors the Python RunnerFactory
 * pattern: it knows about supported provider packages, loads them dynamically
 * via {@link _getProviderFactory}, and delegates creation to the factory
 * instance methods on {@link AIProvider}.
 *
 * Provider packages implement {@link AIProvider} factory methods
 * (`createModel`, `createAgent`, `createAgentGraph`). The legacy
 * {@link AIProvider} abstract class is retained for backward compatibility,
 * and the {@link _LegacyProviderAdapter} shim wraps packages that have not
 * yet migrated to the new pattern.
 */
export class RunnerFactory {
  /**
   * Load and return the AIProvider factory for the given provider type.
   *
   * This is the single place in the codebase that knows provider package names.
   * If the provider package exports the new `*RunnerFactory` class, it is
   * instantiated directly. Otherwise a {@link _LegacyProviderAdapter} wrapping
   * the old `static create()` class is returned to keep CI green during the
   * transition.
   *
   * @param providerType One of the {@link SUPPORTED_AI_PROVIDERS} values.
   * @param logger Optional logger forwarded to the provider factory.
   * @returns A configured {@link AIProvider} instance, or `undefined` if the
   *   package cannot be loaded.
   */
  private static async _getProviderFactory(
    providerType: SupportedAIProvider,
    logger?: LDLogger,
  ): Promise<AIProvider | undefined> {
    try {
      let module: any;

      switch (providerType) {
        case 'openai': {
          // eslint-disable-next-line import/no-extraneous-dependencies
          module = await import('@launchdarkly/server-sdk-ai-openai' as any);
          return new module.OpenAIRunnerFactory(logger) as AIProvider;
        }
        case 'langchain': {
          // eslint-disable-next-line import/no-extraneous-dependencies
          module = await import('@launchdarkly/server-sdk-ai-langchain' as any);
          return new module.LangChainRunnerFactory(logger) as AIProvider;
        }
        case 'vercel': {
          // eslint-disable-next-line import/no-extraneous-dependencies
          module = await import('@launchdarkly/server-sdk-ai-vercel' as any);
          return new module.VercelRunnerFactory(logger) as AIProvider;
        }
        default:
          return undefined;
      }
    } catch (error: any) {
      logger?.warn(
        `Unable to load provider package. Check that you have installed the correct package. ${error.message}`,
      );
      return undefined;
    }
  }

  /**
   * Determine which providers to try based on defaultAiProvider and providerName.
   *
   * Mirrors Python's `_get_providers_to_try` helper.
   */
  private static _getProvidersToTry(
    defaultAiProvider?: SupportedAIProvider,
    providerName?: string,
  ): SupportedAIProvider[] {
    // If defaultAiProvider is set, only try that specific provider
    if (defaultAiProvider) {
      return [defaultAiProvider];
    }

    const providerSet = new Set<SupportedAIProvider>();

    // First try the specific provider if it's supported
    if (providerName && SUPPORTED_AI_PROVIDERS.includes(providerName as SupportedAIProvider)) {
      providerSet.add(providerName as SupportedAIProvider);
    }

    // Then try multi-provider packages as fallback, avoiding duplicates
    const multiProviderPackages: SupportedAIProvider[] = ['langchain', 'vercel'];
    multiProviderPackages.forEach((provider) => {
      providerSet.add(provider);
    });

    return Array.from(providerSet);
  }

  /**
   * Try each provider in order and return the first non-undefined result.
   *
   * Mirrors Python's `_with_fallback` helper. Loads each provider factory via
   * {@link _getProviderFactory} and calls `fn` with it. Returns the first
   * truthy result, or `undefined` if no provider succeeds.
   *
   * @param providers Ordered list of provider types to try.
   * @param fn Callback that calls the appropriate factory method on the provider.
   * @param logger Optional logger forwarded to each provider factory.
   */
  private static async _withFallback<T>(
    providers: SupportedAIProvider[],
    fn: (factory: AIProvider) => Promise<T | undefined>,
    logger?: LDLogger,
  ): Promise<T | undefined> {
    for (const providerType of providers) {
      logger?.debug(`Attempting to create runner with provider: ${providerType}`);
      // eslint-disable-next-line no-await-in-loop, no-underscore-dangle
      const factory = await RunnerFactory._getProviderFactory(providerType, logger);
      if (factory) {
        // eslint-disable-next-line no-await-in-loop
        const result = await fn(factory);
        if (result) {
          logger?.debug(`Successfully created runner with provider: ${providerType}`);
          return result;
        }
      }
    }
    return undefined;
  }

  /**
   * Create a Runner for the given AI configuration.
   *
   * Suitable for completion, judge, and agent config modes. Dynamically
   * loads the matching provider package via {@link _getProviderFactory} and
   * delegates to its {@link AIProvider.createModel} method.
   *
   * @param config The AI configuration (completion, agent, or judge).
   * @param logger Optional logger forwarded to the underlying provider.
   * @param defaultAiProvider Optional provider override
   *   ('openai', 'langchain', 'vercel', …). When set, only that provider is
   *   tried. When omitted, providers are tried in priority order based on the
   *   provider name in the config.
   * @returns A configured {@link Runner} ready to invoke the model, or
   *   `undefined` if no suitable provider could be loaded.
   */
  static async createModel(
    config: LDAIConfigKind,
    logger?: LDLogger,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<Runner | undefined> {
    const providerName = config.provider?.name?.toLowerCase();
    // eslint-disable-next-line no-underscore-dangle
    const providers = RunnerFactory._getProvidersToTry(defaultAiProvider, providerName);

    // eslint-disable-next-line no-underscore-dangle
    const runner = await RunnerFactory._withFallback(
      providers,
      (factory) => factory.createModel(config),
      logger,
    );

    if (!runner) {
      logger?.warn(
        `Provider is not supported or failed to initialize: ${config.provider?.name ?? 'unknown'}`,
      );
    }

    return runner;
  }

  /**
   * Create a Runner for an agent AI Config.
   *
   * Delegates to the provider factory's {@link AIProvider.createAgent} method.
   *
   * @param config The agent AI configuration.
   * @param tools Optional registry of callable tools.
   * @param logger Optional logger forwarded to the underlying provider.
   * @param defaultAiProvider Optional provider override.
   * @returns A configured {@link Runner}, or `undefined` if no suitable
   *   provider could be loaded.
   */
  static async createAgent(
    config: LDAIConfigKind,
    tools?: ToolRegistry,
    logger?: LDLogger,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<Runner | undefined> {
    const providerName = config.provider?.name?.toLowerCase();
    // eslint-disable-next-line no-underscore-dangle
    const providers = RunnerFactory._getProvidersToTry(defaultAiProvider, providerName);

    // eslint-disable-next-line no-underscore-dangle
    const runner = await RunnerFactory._withFallback(
      providers,
      (factory) => factory.createAgent(config, tools),
      logger,
    );

    if (!runner) {
      logger?.warn(
        `Provider is not supported or failed to initialize: ${config.provider?.name ?? 'unknown'}`,
      );
    }

    return runner;
  }

  /**
   * Create an AgentGraphRunner for the given agent graph definition.
   *
   * Delegates to the provider factory's {@link AIProvider.createAgentGraph} method.
   *
   * @param graphDef The agent graph definition.
   * @param tools Optional registry of callable tools.
   * @param logger Optional logger forwarded to the underlying provider.
   * @param defaultAiProvider Optional provider override.
   * @returns A configured {@link AgentGraphRunner}, or `undefined` if no
   *   suitable provider could be loaded.
   */
  static async createAgentGraph(
    graphDef: AgentGraphDefinition,
    tools?: ToolRegistry,
    logger?: LDLogger,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<AgentGraphRunner | undefined> {
    // AgentGraph does not have a per-node provider name at this level;
    // fall back to all multi-provider packages unless overridden.
    // eslint-disable-next-line no-underscore-dangle
    const providers = RunnerFactory._getProvidersToTry(defaultAiProvider);

    // eslint-disable-next-line no-underscore-dangle
    const runner = await RunnerFactory._withFallback(
      providers,
      (factory) => factory.createAgentGraph(graphDef, tools),
      logger,
    );

    if (!runner) {
      logger?.warn(`No provider could create an AgentGraphRunner for the given graph definition.`);
    }

    return runner;
  }
}
