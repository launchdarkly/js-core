import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import {
  BaseTrackedChat,
  ChatResponse,
  LDAIConfig,
  LDAIConfigTracker,
  LDMessage,
} from '@launchdarkly/server-sdk-ai';

import { LangChainProvider } from './LangChainProvider';

/**
 * LangChain-specific implementation of TrackedChat.
 * This implementation integrates LangChain models with LaunchDarkly's tracking capabilities.
 */
export class LangChainTrackedChat extends BaseTrackedChat {
  private _llm: BaseChatModel;

  constructor(aiConfig: LDAIConfig, tracker: LDAIConfigTracker, llm: BaseChatModel) {
    super(aiConfig, tracker);
    this._llm = llm;
  }

  /**
   * Provider-specific implementation that converts LDMessage[] to LangChain format,
   * invokes the model, and returns a ChatResponse.
   */
  protected async invokeModel(messages: LDMessage[]): Promise<ChatResponse> {
    // Convert LDMessage[] to LangChain messages
    const langchainMessages = LangChainProvider.convertMessagesToLangChain(messages);

    // Get the LangChain response
    const response = await this._llm.invoke(langchainMessages);

    // Extract token usage if available using the helper method
    const usage = LangChainProvider.createTokenUsage(response);

    // Handle different content types from LangChain
    let content: string;
    if (typeof response.content === 'string') {
      content = response.content;
    } else if (Array.isArray(response.content)) {
      // Handle complex content (e.g., with images)
      content = response.content
        .map((item: any) => {
          if (typeof item === 'string') return item;
          if (item.type === 'text') return item.text;
          return '';
        })
        .join('');
    } else {
      content = String(response.content);
    }

    // Create the assistant message
    const assistantMessage: LDMessage = {
      role: 'assistant',
      content,
    };

    return {
      message: assistantMessage,
      usage,
    };
  }

  /**
   * LangChain-specific invoke method that accepts LangChain-native message types.
   * This is the main implementation that does all the tracking and LangChain logic.
   */
  async trackLangChainInvoke(
    messages: (HumanMessage | SystemMessage | AIMessage)[],
  ): Promise<AIMessage> {
    // Use the trackMetricsOf helper to handle all tracking automatically
    return LangChainProvider.trackMetricsOf(this.tracker, () => this._llm.invoke(messages));
  }

  /**
   * Get the underlying LangChain model instance.
   */
  async getChatModel(): Promise<BaseChatModel> {
    return this._llm;
  }
}
