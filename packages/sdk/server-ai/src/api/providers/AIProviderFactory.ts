import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { LDAIConfigKind } from '../config/types';
import { AIProvider } from './AIProvider';

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
 * Factory for creating AIProvider instances based on the provider configuration.
 */
export class AIProviderFactory {
  /**
   * Create an AIProvider instance based on the AI configuration.
   * This method attempts to load provider-specific implementations dynamically.
   * Returns undefined if the provider is not supported.
   *
   * @param aiConfig The AI configuration
   * @param logger Optional logger for logging provider initialization
   * @param defaultAiProvider Optional default AI provider to use
   */
  static async create(
    aiConfig: LDAIConfigKind,
    logger?: LDLogger,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<AIProvider | undefined> {
    const providerName = aiConfig.provider?.name?.toLowerCase();
    // Determine which providers to try based on defaultAiProvider
    const providersToTry = this._getProvidersToTry(defaultAiProvider, providerName);

    // Try each provider in order
    // eslint-disable-next-line no-restricted-syntax
    for (const providerType of providersToTry) {
      // eslint-disable-next-line no-await-in-loop
      const provider = await this._tryCreateProvider(providerType, aiConfig, logger);
      if (provider) {
        return provider;
      }
    }

    // If no provider was successfully created, log a warning
    logger?.warn(
      `Provider is not supported or failed to initialize: ${aiConfig.provider?.name ?? 'unknown'}`,
    );
    return undefined;
  }

  /**
   * Determine which providers to try based on defaultAiProvider and providerName.
   */
  private static _getProvidersToTry(
    defaultAiProvider?: SupportedAIProvider,
    providerName?: string,
  ): SupportedAIProvider[] {
    // If defaultAiProvider is set, only try that specific provider
    if (defaultAiProvider) {
      return [defaultAiProvider];
    }

    // If no defaultAiProvider is set, try all providers in order
    const providerSet = new Set<SupportedAIProvider>();

    // First try the specific provider if it's supported
    if (providerName && SUPPORTED_AI_PROVIDERS.includes(providerName as SupportedAIProvider)) {
      providerSet.add(providerName as SupportedAIProvider);
    }

    // Then try multi-provider packages, but avoid duplicates
    const multiProviderPackages: SupportedAIProvider[] = ['langchain', 'vercel'];
    multiProviderPackages.forEach((provider) => {
      providerSet.add(provider);
    });

    return Array.from(providerSet);
  }

  /**
   * Try to create a provider of the specified type.
   */
  private static async _tryCreateProvider(
    providerType: SupportedAIProvider,
    aiConfig: LDAIConfigKind,
    logger?: LDLogger,
  ): Promise<AIProvider | undefined> {
    let getProviderClass: () => Promise<typeof AIProvider | undefined>;

    switch (providerType) {
      case 'openai':
        // Lambda with hardcoded import - webpack can statically analyze this
        getProviderClass = async () => {
          // eslint-disable-next-line import/no-extraneous-dependencies
          const module = await import('@launchdarkly/server-sdk-ai-openai');
          return module.OpenAIProvider as unknown as typeof AIProvider;
        };
        break;
      case 'langchain':
        // Lambda with hardcoded import - webpack can statically analyze this
        getProviderClass = async () => {
          // eslint-disable-next-line import/no-extraneous-dependencies
          const module = await import('@launchdarkly/server-sdk-ai-langchain');
          return module.LangChainProvider as unknown as typeof AIProvider;
        };
        break;
      case 'vercel':
        // Lambda with hardcoded import - webpack can statically analyze this
        getProviderClass = async () => {
          // eslint-disable-next-line import/no-extraneous-dependencies
          const module = await import('@launchdarkly/server-sdk-ai-vercel');
          return module.VercelProvider as unknown as typeof AIProvider;
        };
        break;
      default:
        return undefined;
    }

    return this._createProvider(getProviderClass, providerType, aiConfig, logger);
  }

  /**
   * Create a provider instance dynamically.
   * @param getProviderClass Lambda function that imports the module and returns the provider class
   * @param providerType Provider type name for error messages
   * @param aiConfig The AI configuration
   * @param logger Optional logger
   */
  private static async _createProvider(
    getProviderClass: () => Promise<typeof AIProvider | undefined>,
    providerType: SupportedAIProvider,
    aiConfig: LDAIConfigKind,
    logger?: LDLogger,
  ): Promise<AIProvider | undefined> {
    try {
      const ProviderClass = await getProviderClass();

      if (!ProviderClass) {
        logger?.warn(`Provider class not found for provider ${providerType}`);
        return undefined;
      }

      const provider = await ProviderClass.create(aiConfig, logger);
      logger?.debug(
        `Successfully created AIProvider for: ${aiConfig.provider?.name} with provider ${providerType}`,
      );
      return provider;
    } catch (error) {
      // Provide helpful error message if module is not found
      const err = error as Error & { code?: string };
      if (err.code === 'ERR_MODULE_NOT_FOUND' || err.message?.includes('Cannot find module')) {
        logger?.warn(
          `Error creating AIProvider for: ${aiConfig.provider?.name} with provider ${providerType}: ${err.message}. ` +
            `Please install the required package with your preferred package manager.`,
        );
      } else {
        logger?.warn(
          `Error creating AIProvider for: ${aiConfig.provider?.name} with provider ${providerType}: ${error}`,
        );
      }
      return undefined;
    }
  }
}
