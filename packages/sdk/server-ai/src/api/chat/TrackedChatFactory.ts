import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { LDAIConfig } from '../config/LDAIConfig';
import { LDAIConfigTracker } from '../config/LDAIConfigTracker';
import { AIProvider } from '../providers/AIProvider';
import { TrackedChat } from './TrackedChat';

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
   */
  static async create(
    aiConfig: LDAIConfig,
    tracker: LDAIConfigTracker,
    logger?: LDLogger,
  ): Promise<TrackedChat | undefined> {
    const provider = await this._createAIProvider(aiConfig, logger);
    if (!provider) {
      logger?.warn(
        `Provider is not supported or failed to initialize: ${aiConfig.provider?.name ?? 'unknown'}`,
      );
      return undefined;
    }

    logger?.debug(`Successfully created TrackedChat for provider: ${aiConfig.provider?.name}`);
    return new TrackedChat(aiConfig, tracker, provider);
  }

  /**
   * Create an AIProvider instance based on the AI configuration.
   * This method attempts to load provider-specific implementations dynamically.
   */
  private static async _createAIProvider(
    aiConfig: LDAIConfig,
    logger?: LDLogger,
  ): Promise<AIProvider | undefined> {
    const providerName = aiConfig.provider?.name?.toLowerCase();
    logger?.debug(`Attempting to create AI provider: ${providerName ?? 'unknown'}`);
    let provider: AIProvider | undefined;

    // Try specific implementations for the provider
    switch (providerName) {
      case 'openai':
        // TODO: Return OpenAI AIProvider implementation when available
        provider = undefined;
        break;
      case 'bedrock':
        // TODO: Return Bedrock AIProvider implementation when available
        provider = undefined;
        break;
      default:
        provider = undefined;
    }

    // If no specific implementation worked, try the multi-provider packages
    if (!provider) {
      provider = await this._createLangChainProvider(aiConfig, logger);
    }

    return provider;
  }

  /**
   * Create a LangChain AIProvider instance if the LangChain provider is available.
   */
  private static async _createLangChainProvider(
    aiConfig: LDAIConfig,
    logger?: LDLogger,
  ): Promise<AIProvider | undefined> {
    try {
      logger?.debug('Attempting to load LangChain provider');
      // Try to dynamically import the LangChain provider
      // This will work if @launchdarkly/server-sdk-ai-langchain is installed
      // eslint-disable-next-line import/no-extraneous-dependencies, global-require
      const { LangChainProvider } = require('@launchdarkly/server-sdk-ai-langchain');

      const provider = await LangChainProvider.create(aiConfig);
      logger?.debug('Successfully created LangChain provider');
      return provider;
    } catch (error) {
      // If the LangChain provider is not available or creation fails, return undefined
      logger?.error(`Error creating LangChain provider: ${error}`);
      return undefined;
    }
  }
}
