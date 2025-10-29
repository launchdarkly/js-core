import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { ChatResponse } from '../chat/types';
import { LDAIConfigKind, LDMessage } from '../config/types';
import { StructuredResponse } from '../judge/types';

/**
 * Abstract base class for AI providers that implement chat model functionality.
 * This class provides the contract that all provider implementations must follow
 * to integrate with LaunchDarkly's tracking and configuration capabilities.
 *
 * Following the AICHAT spec recommendation to use base classes with non-abstract methods
 * for better extensibility and backwards compatibility.
 */
export abstract class AIProvider {
  protected readonly logger?: LDLogger;

  constructor(logger?: LDLogger) {
    this.logger = logger;
  }
  /**
   * Invoke the chat model with an array of messages.
   * This method should convert messages to provider format, invoke the model,
   * and return a ChatResponse with the result and metrics.
   *
   * @param messages Array of LDMessage objects representing the conversation
   * @returns Promise that resolves to a ChatResponse containing the model's response
   */
  abstract invokeModel(messages: LDMessage[]): Promise<ChatResponse>;

  /**
   * Invoke the chat model with structured output support.
   * This method should convert messages to provider format, invoke the model with
   * structured output configuration, and return a structured response.
   *
   * @param messages Array of LDMessage objects representing the conversation
   * @param outputs Dictionary of output configurations keyed by output name
   * @returns Promise that resolves to a structured response
   */
  abstract invokeStructuredModel(
    messages: LDMessage[],
    responseStructure: Record<string, unknown>,
  ): Promise<StructuredResponse>;

  /**
   * Static method that constructs an instance of the provider.
   * Each provider implementation must provide their own static create method
   * that accepts an AIConfig and returns a configured instance.
   *
   * @param aiConfig The LaunchDarkly AI configuration
   * @param logger Optional logger for the provider
   * @returns Promise that resolves to a configured provider instance
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async create(aiConfig: LDAIConfigKind, logger?: LDLogger): Promise<AIProvider> {
    throw new Error('Provider implementations must override the static create method');
  }
}
