import { generateText } from 'ai';
import { LanguageModelV2 } from '@ai-sdk/provider';

import { LDLogger } from '@launchdarkly/js-server-sdk-common';
import {
  AIProvider,
  ChatResponse,
  LDAIConfig,
  LDAIMetrics,
  LDMessage,
  LDTokenUsage,
} from '@launchdarkly/server-sdk-ai';

/**
 * Vercel AI implementation of AIProvider.
 * This provider integrates Vercel AI SDK with LaunchDarkly's tracking capabilities.
 */
export class VercelProvider extends AIProvider {
  private _model: LanguageModelV2;
  private _parameters: Record<string, unknown>;

  constructor(
    model: LanguageModelV2,
    parameters: Record<string, unknown>,
    logger?: LDLogger,
  ) {
    super(logger);
    this._model = model;
    this._parameters = parameters;
  }

  // =============================================================================
  // MAIN FACTORY METHOD
  // =============================================================================

  /**
   * Static factory method to create a Vercel AIProvider from an AI configuration.
   */
  static async create(aiConfig: LDAIConfig, logger?: LDLogger): Promise<VercelProvider> {
    const model = await VercelProvider.createVercelModel(aiConfig);
    const parameters = aiConfig.model?.parameters || {};
    return new VercelProvider(model, parameters, logger);
  }

  // =============================================================================
  // INSTANCE METHODS (AIProvider Implementation)
  // =============================================================================

  /**
   * Invoke the Vercel AI model with an array of messages.
   */
  async invokeModel(messages: LDMessage[]): Promise<ChatResponse> {
    // Call Vercel AI generateText
    const result = await generateText({
      model: this._model,
      messages,
      ...this._parameters,
    });

    // Create the assistant message
    const assistantMessage: LDMessage = {
      role: 'assistant',
      content: result.text,
    };

    // Extract metrics including token usage and success status
    const metrics = VercelProvider.createAIMetrics(result);

    return {
      message: assistantMessage,
      metrics,
    };
  }

  /**
   * Get the underlying Vercel AI model instance.
   */
  getModel(): LanguageModelV2 {
    return this._model;
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
      gemini: 'google',
    };

    return mapping[lowercasedName] || lowercasedName;
  }

  /**
   * Create AI metrics information from a Vercel AI response.
   * This method extracts token usage information and success status from Vercel AI responses
   * and returns a LaunchDarkly AIMetrics object.
   */
  static createAIMetrics(vercelResponse: any): LDAIMetrics {
    // Extract token usage if available
    let usage: LDTokenUsage | undefined;
    if (vercelResponse?.usage) {
      const { promptTokens, completionTokens, totalTokens } = vercelResponse.usage;
      usage = {
        total: totalTokens || 0,
        input: promptTokens || 0,
        output: completionTokens || 0,
      };
    }

    // Vercel AI responses that complete successfully are considered successful
    return {
      success: true,
      usage,
    };
  }

  /**
   * Create a Vercel AI model from an AI configuration.
   * This method creates a Vercel AI model based on the provider configuration.
   *
   * @param aiConfig The LaunchDarkly AI configuration
   * @returns A Promise that resolves to a configured Vercel AI model
   */
  static async createVercelModel(aiConfig: LDAIConfig): Promise<LanguageModelV2> {
    const providerName = VercelProvider.mapProvider(aiConfig.provider?.name || '');
    const modelName = aiConfig.model?.name || '';
    // Parameters are not used in model creation but kept for future use
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const parameters = aiConfig.model?.parameters || {};

    // Map provider names to their corresponding Vercel AI SDK imports
    switch (providerName) {
      case 'openai':
        try {
          const { openai } = await import('@ai-sdk/openai');
          return openai(modelName);
        } catch (error) {
          throw new Error(`Failed to load @ai-sdk/openai: ${error}`);
        }
      case 'anthropic':
        try {
          const { anthropic } = await import('@ai-sdk/anthropic' as any);
          return anthropic(modelName);
        } catch (error) {
          throw new Error(`Failed to load @ai-sdk/anthropic: ${error}`);
        }
      case 'google':
        try {
          const { google } = await import('@ai-sdk/google' as any);
          return google(modelName);
        } catch (error) {
          throw new Error(`Failed to load @ai-sdk/google: ${error}`);
        }
      case 'cohere':
        try {
          const { cohere } = await import('@ai-sdk/cohere' as any);
          return cohere(modelName);
        } catch (error) {
          throw new Error(`Failed to load @ai-sdk/cohere: ${error}`);
        }
      case 'mistral':
        try {
          const { mistral } = await import('@ai-sdk/mistral' as any);
          return mistral(modelName);
        } catch (error) {
          throw new Error(`Failed to load @ai-sdk/mistral: ${error}`);
        }
      default:
        throw new Error(`Unsupported Vercel AI provider: ${providerName}`);
    }
  }
}
