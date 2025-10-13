import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { LDAIConfig } from '../config/LDAIConfig';
import { LDAIConfigTracker } from '../config/LDAIConfigTracker';
import { AIProvider } from '../providers/AIProvider';
import { TrackedChat } from './TrackedChat';

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
 * Factory for creating TrackedChat instances based on the provider configuration.
 */
export class TrackedChatFactory {
  /**
   * Create a TrackedChat instance based on the AI configuration.
   * This method attempts to load provider-specific implementations dynamically.
   * Returns undefined if the provider is not supported.
   *
   * @param aiConfig The AI configuration
   * @param tracker The tracker for AI operations
   * @param logger Optional logger for logging provider initialization
   * @param defaultAiProvider Optional default AI provider to use
   */
  static async create(
    aiConfig: LDAIConfig,
    tracker: LDAIConfigTracker,
    logger?: LDLogger,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<TrackedChat | undefined> {
    const provider = await this._createAIProvider(aiConfig, logger, defaultAiProvider);
    if (!provider) {
      logger?.warn(
        `Provider is not supported or failed to initialize: ${aiConfig.provider?.name ?? 'unknown'}`,
      );
      return undefined;
    }

    return new TrackedChat(aiConfig, tracker, provider);
  }

  /**
   * Create an AIProvider instance based on the AI configuration.
   * This method attempts to load provider-specific implementations dynamically.
   */
  private static async _createAIProvider(
    aiConfig: LDAIConfig,
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
    const providers: SupportedAIProvider[] = [];

    // First try the specific provider if it's supported
    if (providerName && SUPPORTED_AI_PROVIDERS.includes(providerName as SupportedAIProvider)) {
      providers.push(providerName as SupportedAIProvider);
    }

    // Then try multi-provider packages
    providers.push('langchain', 'vercel');

    return providers;
  }

  /**
   * Try to create a provider of the specified type.
   */
  private static async _tryCreateProvider(
    providerType: SupportedAIProvider,
    aiConfig: LDAIConfig,
    logger?: LDLogger,
  ): Promise<AIProvider | undefined> {
    switch (providerType) {
      case 'openai':
        return this._createProvider('@launchdarkly/server-sdk-ai-openai', 'OpenAIProvider', aiConfig, logger);
      case 'langchain':
        return this._createProvider('@launchdarkly/server-sdk-ai-langchain', 'LangChainProvider', aiConfig, logger);
      case 'vercel':
        return this._createProvider('@launchdarkly/server-sdk-ai-vercel', 'VercelProvider', aiConfig, logger);
      default:
        return undefined;
    }
  }

  /**
   * Create a provider instance dynamically.
   */
  private static async _createProvider(
    packageName: string,
    providerClassName: string,
    aiConfig: LDAIConfig,
    logger?: LDLogger,
  ): Promise<AIProvider | undefined> {
    try {
      // Try to dynamically import the provider
      // This will work if the package is installed
      // eslint-disable-next-line import/no-extraneous-dependencies, global-require, import/no-dynamic-require
      const { [providerClassName]: ProviderClass } = require(packageName);

      const provider = await ProviderClass.create(aiConfig, logger);
      logger?.debug(
        `Successfully created AIProvider for: ${aiConfig.provider?.name} with package ${packageName}`,
      );
      return provider;
    } catch (error) {
      // If the provider is not available or creation fails, return undefined
      logger?.warn(
        `Error creating AIProvider for: ${aiConfig.provider?.name} with package ${packageName}: ${error}`,
      );
      return undefined;
    }
  }

}
