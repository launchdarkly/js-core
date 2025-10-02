import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { initChatModel } from 'langchain/chat_models/universal';

import {
  LDAIConfig,
  LDAIConfigTracker,
  LDMessage,
  LDTokenUsage,
} from '@launchdarkly/server-sdk-ai';

/**
 * LangChain provider utilities and helper functions.
 */
export class LangChainProvider {
  /**
   * Map LaunchDarkly provider names to LangChain provider names.
   * This method enables seamless integration between LaunchDarkly's standardized
   * provider naming and LangChain's naming conventions.
   */
  static mapProvider(ldProviderName: string): string {
    const lowercasedName = ldProviderName.toLowerCase();

    const mapping: Record<string, string> = {
      gemini: 'google-genai',
    };

    return mapping[lowercasedName] || lowercasedName;
  }

  /**
   * Create token usage information from a LangChain provider response.
   * This method extracts token usage information from LangChain responses
   * and returns a LaunchDarkly TokenUsage object.
   */
  static createTokenUsage(langChainResponse: AIMessage): LDTokenUsage | undefined {
    if (!langChainResponse?.response_metadata?.tokenUsage) {
      return undefined;
    }

    const { tokenUsage } = langChainResponse.response_metadata;

    return {
      total: tokenUsage.totalTokens || 0,
      input: tokenUsage.promptTokens || 0,
      output: tokenUsage.completionTokens || 0,
    };
  }

  /**
   * Convert LaunchDarkly messages to LangChain messages.
   * This helper method enables developers to work directly with LangChain message types
   * while maintaining compatibility with LaunchDarkly's standardized message format.
   */
  static convertMessagesToLangChain(
    messages: LDMessage[],
  ): (HumanMessage | SystemMessage | AIMessage)[] {
    return messages.map((msg) => {
      switch (msg.role) {
        case 'system':
          return new SystemMessage(msg.content);
        case 'user':
          return new HumanMessage(msg.content);
        case 'assistant':
          return new AIMessage(msg.content);
        default:
          throw new Error(`Unsupported message role: ${msg.role}`);
      }
    });
  }

  /**
   * Track metrics for a LangChain callable execution.
   * This helper method enables developers to work directly with LangChain callables
   * while ensuring consistent tracking behavior.
   */
  static async trackMetricsOf(
    tracker: LDAIConfigTracker,
    callable: () => Promise<AIMessage>,
  ): Promise<AIMessage> {
    return tracker.trackDurationOf(async () => {
      try {
        const result = await callable();

        // Extract and track token usage if available
        const tokenUsage = this.createTokenUsage(result);
        if (tokenUsage) {
          tracker.trackTokens({
            total: tokenUsage.total,
            input: tokenUsage.input,
            output: tokenUsage.output,
          });
        }

        tracker.trackSuccess();
        return result;
      } catch (error) {
        tracker.trackError();
        throw error;
      }
    });
  }

  /**
   * Create a LangChain model from an AI configuration.
   * This public helper method enables developers to initialize their own LangChain models
   * using LaunchDarkly AI configurations.
   *
   * @param aiConfig The LaunchDarkly AI configuration
   * @returns A Promise that resolves to a configured LangChain BaseChatModel
   */
  static async createLangChainModel(aiConfig: LDAIConfig): Promise<BaseChatModel> {
    const modelName = aiConfig.model?.name || '';
    const provider = aiConfig.provider?.name || '';
    const parameters = aiConfig.model?.parameters || {};

    // Use LangChain's universal initChatModel to support multiple providers
    return initChatModel(modelName, {
      modelProvider: this.mapProvider(provider),
      ...parameters,
    });
  }
}
