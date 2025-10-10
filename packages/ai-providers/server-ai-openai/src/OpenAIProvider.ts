import { OpenAI } from 'openai';

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
 * OpenAI implementation of AIProvider.
 * This provider integrates OpenAI's chat completions API with LaunchDarkly's tracking capabilities.
 */
export class OpenAIProvider extends AIProvider {
  private _client: OpenAI;
  private _modelName: string;
  private _parameters: Record<string, unknown>;

  constructor(client: OpenAI, modelName: string, parameters: Record<string, unknown>, logger?: LDLogger) {
    super(logger);
    this._client = client;
    this._modelName = modelName;
    this._parameters = parameters;
  }

  // =============================================================================
  // MAIN FACTORY METHOD
  // =============================================================================

  /**
   * Static factory method to create an OpenAI AIProvider from an AI configuration.
   */
  static async create(aiConfig: LDAIConfig, logger?: LDLogger): Promise<OpenAIProvider> {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const modelName = aiConfig.model?.name || '';
    const parameters = aiConfig.model?.parameters || {};
    return new OpenAIProvider(client, modelName, parameters, logger);
  }

  // =============================================================================
  // INSTANCE METHODS (AIProvider Implementation)
  // =============================================================================

  /**
   * Invoke the OpenAI model with an array of messages.
   */
  async invokeModel(messages: LDMessage[]): Promise<ChatResponse> {
    // Call OpenAI chat completions API
    const response = await this._client.chat.completions.create({
      model: this._modelName,
      messages: messages,
      ...this._parameters,
    });

    // Extract the first choice content
    const choice = response.choices[0];
    if (!choice?.message?.content) {
      throw new Error('No content in OpenAI response');
    }

    // Create the assistant message
    const assistantMessage: LDMessage = {
      role: 'assistant',
      content: choice.message.content,
    };

    // Extract metrics including token usage and success status
    const metrics = OpenAIProvider.createAIMetrics(response);

    return {
      message: assistantMessage,
      metrics,
    };
  }

  /**
   * Get the underlying OpenAI client instance.
   */
  getClient(): OpenAI {
    return this._client;
  }


  // =============================================================================
  // STATIC UTILITY METHODS
  // =============================================================================

  /**
   * Create AI metrics information from an OpenAI response.
   * This method extracts token usage information and success status from OpenAI responses
   * and returns a LaunchDarkly AIMetrics object.
   */
  static createAIMetrics(openaiResponse: any): LDAIMetrics {
    // Extract token usage if available
    let usage: LDTokenUsage | undefined;
    if (openaiResponse?.usage) {
      const { prompt_tokens, completion_tokens, total_tokens } = openaiResponse.usage;
      usage = {
        total: total_tokens || 0,
        input: prompt_tokens || 0,
        output: completion_tokens || 0,
      };
    }

    // OpenAI responses that complete successfully are considered successful
    return {
      success: true,
      usage,
    };
  }

}
