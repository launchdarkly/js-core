import { LDAIConfig, LDMessage } from '../config/LDAIConfig';
import { LDAIConfigTracker } from '../config/LDAIConfigTracker';
import { LDTokenUsage } from '../metrics/LDTokenUsage';

/**
 * Chat response structure.
 */
export interface ChatResponse {
  /**
   * The response message from the AI.
   */
  message: LDMessage;

  /**
   * Token usage information.
   */
  usage?: LDTokenUsage;

  /**
   * Additional metadata from the provider.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Interface for provider-specific tracked chat implementations.
 */
export interface ProviderTrackedChat {
  /**
   * Invoke the chat model with the provided messages.
   * This method provides a consistent interface for chat model execution while integrating
   * LaunchDarkly-specific functionality.
   *
   * @param prompt A prompt string that will be converted to a user message and added to the conversation history.
   * @returns A promise that resolves to the chat response.
   */
  invoke(prompt: string): Promise<ChatResponse>;

  /**
   * Get the underlying AI configuration used to initialize this TrackedChat.
   *
   * @returns The AI configuration.
   */
  getConfig(): LDAIConfig;

  /**
   * Get the underlying AI configuration tracker used to initialize this TrackedChat.
   *
   * @returns The AI configuration tracker.
   */
  getTracker(): LDAIConfigTracker;

  /**
   * Get the underlying provider-specific chat model instance.
   * This provides direct access to the underlying provider chat model for advanced use cases.
   *
   * @returns The configured provider-specific chat model instance.
   */
  getChatModel(): unknown;
}
