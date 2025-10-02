import { LDAIConfig } from '../config/LDAIConfig';
import { LDAIConfigTracker } from '../config/LDAIConfigTracker';
import { BaseTrackedChat } from './BaseTrackedChat';

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
  ): Promise<BaseTrackedChat | undefined> {
    const providerName = aiConfig.provider?.name?.toLowerCase();
    let trackedChat: BaseTrackedChat | undefined;

    // Try specific implementations for the provider
    switch (providerName) {
      case 'openai':
        trackedChat = undefined;
        break;
      case 'bedrock':
        trackedChat = undefined;
        break;
      default:
        trackedChat = undefined;
    }

    // If no specific implementation worked, try LangChain as fallback
    if (!trackedChat) {
      trackedChat = await this._createLangChainTrackedChat(aiConfig, tracker);
    }

    // If LangChain didn't work, try Vercel as fallback
    if (!trackedChat) {
      // TODO: Return Vercel AI SDK implementation when available
      // trackedChat = this._createVercelTrackedChat(aiConfig, tracker);
    }

    return trackedChat;
  }

  /**
   * Create a LangChain TrackedChat instance if the LangChain provider is available.
   */
  private static async _createLangChainTrackedChat(
    aiConfig: LDAIConfig,
    tracker: LDAIConfigTracker,
  ): Promise<BaseTrackedChat | undefined> {
    try {
      // Try to dynamically import the LangChain provider
      // This will work if @launchdarkly/server-sdk-ai-langchain is installed
      // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-extraneous-dependencies
      const { LangChainTrackedChat, LangChainProvider } = require('@launchdarkly/server-sdk-ai-langchain');

      // Build the LLM during factory creation to catch errors early
      const llm = await LangChainProvider.createLangChainModel(aiConfig);
      return new LangChainTrackedChat(aiConfig, tracker, llm);
    } catch (error) {
      // If the LangChain provider is not available or LLM creation fails, return undefined
      return undefined;
    }
  }
}
