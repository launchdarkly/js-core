import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { initChatModel } from 'langchain/chat_models/universal';

import {
  AIProvider,
  ChatResponse,
  LDAIConfig,
  LDAIMetrics,
  LDLogger,
  LDMessage,
  LDTokenUsage,
} from '@launchdarkly/server-sdk-ai';

/**
 * LangChain implementation of AIProvider.
 * This provider integrates LangChain models with LaunchDarkly's tracking capabilities.
 */
export class LangChainProvider extends AIProvider {
  private _llm: BaseChatModel;

  constructor(llm: BaseChatModel, logger?: LDLogger) {
    super(logger);
    this._llm = llm;
  }

  // =============================================================================
  // MAIN FACTORY METHOD
  // =============================================================================

  /**
   * Static factory method to create a LangChain AIProvider from an AI configuration.
   */
  static async create(aiConfig: LDAIConfig, logger?: LDLogger): Promise<LangChainProvider> {
    const llm = await LangChainProvider.createLangChainModel(aiConfig);
    return new LangChainProvider(llm, logger);
  }

  // =============================================================================
  // INSTANCE METHODS (AIProvider Implementation)
  // =============================================================================

  /**
   * Invoke the LangChain model with an array of messages.
   */
  async invokeModel(messages: LDMessage[]): Promise<ChatResponse> {
    // Convert LDMessage[] to LangChain messages
    const langchainMessages = LangChainProvider.convertMessagesToLangChain(messages);

    // Get the LangChain response
    const response: AIMessage = await this._llm.invoke(langchainMessages);

    // Generate metrics early (assumes success by default)
    const metrics = LangChainProvider.createAIMetrics(response);

    // Extract text content from the response
    let content: string = '';
    if (typeof response.content === 'string') {
      content = response.content;
    } else {
      // Log warning for non-string content (likely multimodal)
      this.logger?.warn(
        `Multimodal response not supported, expecting a string. Content type: ${typeof response.content}, Content:`,
        JSON.stringify(response.content, null, 2),
      );
      // Update metrics to reflect content loss
      metrics.success = false;
    }

    // Create the assistant message
    const assistantMessage: LDMessage = {
      role: 'assistant',
      content,
    };

    return {
      message: assistantMessage,
      metrics,
    };
  }

  /**
   * Get the underlying LangChain model instance.
   */
  getChatModel(): BaseChatModel {
    return this._llm;
  }

  // =============================================================================
  // STATIC UTILITY METHODS
  // =============================================================================

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
   * Create AI metrics information from a LangChain provider response.
   * This method extracts token usage information and success status from LangChain responses
   * and returns a LaunchDarkly AIMetrics object.
   *
   * @param langChainResponse The response from the LangChain model
   * @example
   * ```typescript
   * // Use with tracker.trackMetricsOf for automatic tracking
   * const response = await tracker.trackMetricsOf(
   *   (result: AIMessage) => LangChainProvider.createAIMetrics(result),
   *   () => llm.invoke(messages)
   * );
   * ```
   */
  static createAIMetrics(langChainResponse: AIMessage): LDAIMetrics {
    // Extract token usage if available
    let usage: LDTokenUsage | undefined;
    if (langChainResponse?.response_metadata?.tokenUsage) {
      const { tokenUsage } = langChainResponse.response_metadata;
      usage = {
        total: tokenUsage.totalTokens || 0,
        input: tokenUsage.promptTokens || 0,
        output: tokenUsage.completionTokens || 0,
      };
    }

    // LangChain responses that complete successfully are considered successful by default
    return {
      success: true,
      usage,
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
      modelProvider: LangChainProvider.mapProvider(provider),
      ...parameters,
    });
  }
}
