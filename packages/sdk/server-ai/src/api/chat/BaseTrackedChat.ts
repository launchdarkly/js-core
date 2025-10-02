import { LDAIConfig, LDMessage } from '../config/LDAIConfig';
import { LDAIConfigTracker } from '../config/LDAIConfigTracker';
import { ChatResponse } from './TrackedChat';

/**
 * Base implementation of TrackedChat that provides common functionality.
 * This can be extended by provider-specific implementations.
 */
export abstract class BaseTrackedChat {
  protected messages: LDMessage[];

  constructor(
    protected readonly aiConfig: LDAIConfig,
    protected readonly tracker: LDAIConfigTracker,
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
    const response = await this.trackMetricsOf(() => this.invokeModel(this.messages));

    // Add the assistant response to the conversation history
    this.messages.push(response.message);

    return response;
  }

  /**
   * Abstract method that providers must implement to handle the actual model invocation.
   * This method should convert messages to provider format, invoke the model, and return a ChatResponse.
   */
  protected abstract invokeModel(messages: LDMessage[]): Promise<ChatResponse>;

  /**
   * Track metrics for a ChatResponse execution.
   * This method handles duration tracking, token usage tracking, and success/error tracking.
   */
  protected async trackMetricsOf(callable: () => Promise<ChatResponse>): Promise<ChatResponse> {
    return this.tracker.trackDurationOf(async () => {
      try {
        const result = await callable();

        // Track token usage if available
        if (result.usage) {
          this.tracker.trackTokens(result.usage);
        }

        this.tracker.trackSuccess();
        return result;
      } catch (error) {
        this.tracker.trackError();
        throw error;
      }
    });
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
}
