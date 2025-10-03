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
   */
  static async create(
    aiConfig: LDAIConfig,
    tracker: LDAIConfigTracker,
  ): Promise<TrackedChat | undefined> {
    const provider = await this._createAIProvider(aiConfig);
    if (!provider) {
      return undefined;
    }

    return new TrackedChat(aiConfig, tracker, provider);
  }

  /**
   * Create an AIProvider instance based on the AI configuration.
   * This method attempts to load provider-specific implementations dynamically.
   */
  private static async _createAIProvider(aiConfig: LDAIConfig): Promise<AIProvider | undefined> {
    const providerName = aiConfig.provider?.name?.toLowerCase();

    // Try specific implementations for the provider
    switch (providerName) {
      case 'openai':
        // TODO: Return OpenAI AIProvider implementation when available
        return undefined;
      case 'bedrock':
        // TODO: Return Bedrock AIProvider implementation when available
        return undefined;
      default:
        // Try LangChain as fallback
        return this._createLangChainProvider(aiConfig);
    }
  }

  /**
   * Create a LangChain AIProvider instance if the LangChain provider is available.
   */
  private static async _createLangChainProvider(
    aiConfig: LDAIConfig,
  ): Promise<AIProvider | undefined> {
    try {
      // Try to dynamically import the LangChain provider
      // This will work if @launchdarkly/server-sdk-ai-langchain is installed
      // eslint-disable-next-line import/no-extraneous-dependencies, global-require
      const { LangChainProvider } = require('@launchdarkly/server-sdk-ai-langchain');

      return LangChainProvider.create(aiConfig);
    } catch (error) {
      // If the LangChain provider is not available or creation fails, return undefined
      return undefined;
    }
  }
}
