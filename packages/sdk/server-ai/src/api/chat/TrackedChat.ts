import { LDAIConfig, LDMessage } from '../config/LDAIConfig';
import { LDAIConfigTracker } from '../config/LDAIConfigTracker';
import { AIProvider } from '../providers/AIProvider';
import { ChatResponse } from './types';

/**
 * Concrete implementation of TrackedChat that provides chat functionality
 * by delegating to an AIProvider implementation.
 * This class handles conversation management and tracking, while delegating
 * the actual model invocation to the provider.
 */
export class TrackedChat {
  protected messages: LDMessage[];

  constructor(
    protected readonly aiConfig: LDAIConfig,
    protected readonly tracker: LDAIConfigTracker,
    protected readonly provider: AIProvider,
  ) {
    this.messages = aiConfig.messages || [];
  }

  /**
   * Invoke the chat model with a prompt string.
   * This method handles conversation management and tracking, delegating to the provider's invokeModel method.
   */
  async invoke(prompt: string): Promise<ChatResponse> {
    // Convert prompt string to LDMessage with role 'user' and add to conversation history
    const userMessage: LDMessage = {
      role: 'user',
      content: prompt,
    };
    this.messages.push(userMessage);

    // Delegate to provider-specific implementation with tracking
    const response = await this.tracker.trackMetricsOf(
      (result: ChatResponse) => result.metrics,
      () => this.provider.invokeModel(this.messages),
    );

    // Add the assistant response to the conversation history
    this.messages.push(response.message);

    return response;
  }

  /**
   * Get the underlying AI configuration used to initialize this TrackedChat.
   */
  getConfig(): LDAIConfig {
    return this.aiConfig;
  }

  /**
   * Get the underlying AI configuration tracker used to initialize this TrackedChat.
   */
  getTracker(): LDAIConfigTracker {
    return this.tracker;
  }

  /**
   * Get the underlying AI provider instance.
   * This provides direct access to the provider for advanced use cases.
   */
  getProvider(): AIProvider {
    return this.provider;
  }
}
