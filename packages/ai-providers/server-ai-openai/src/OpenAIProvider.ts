import { OpenAI } from 'openai';

import { AIProvider } from '@launchdarkly/server-sdk-ai';
import type {
  ChatResponse,
  LDAIConfig,
  LDAIMetrics,
  LDLogger,
  LDMessage,
  LDTokenUsage,
  StructuredResponse,
} from '@launchdarkly/server-sdk-ai';

/**
 * OpenAI implementation of AIProvider.
 * This provider integrates OpenAI's chat completions API with LaunchDarkly's tracking capabilities.
 */
export class OpenAIProvider extends AIProvider {
  private _client: OpenAI;
  private _modelName: string;
  private _parameters: Record<string, unknown>;

  constructor(
    client: OpenAI,
    modelName: string,
    parameters: Record<string, unknown>,
    logger?: LDLogger,
  ) {
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
      messages,
      ...this._parameters,
    });

    // Generate metrics early (assumes success by default)
    const metrics = OpenAIProvider.createAIMetrics(response);

    // Safely extract the first choice content using optional chaining
    const content = response?.choices?.[0]?.message?.content || '';

    if (!content) {
      this.logger?.warn('OpenAI response has no content available');
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
   * Invoke the OpenAI model with structured output support.
   */
  async invokeStructuredModel(
    messages: LDMessage[],
    responseStructure: Record<string, unknown>,
  ): Promise<StructuredResponse> {
    // Call OpenAI chat completions API with structured output
    const response = await this._client.chat.completions.create({
      model: this._modelName,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'structured_output',
          schema: responseStructure,
          strict: true,
        },
      },
      ...this._parameters,
    });

    // Generate metrics early (assumes success by default)
    const metrics = OpenAIProvider.createAIMetrics(response);

    // Safely extract the first choice content using optional chaining
    const content = response?.choices?.[0]?.message?.content || '';

    if (!content) {
      this.logger?.warn('OpenAI structured response has no content available');
      metrics.success = false;
    }

    // Parse the structured JSON response
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(content);
    } catch (error) {
      this.logger?.warn('Failed to parse structured response as JSON:', error);
      metrics.success = false;
    }

    return {
      data,
      rawResponse: content,
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

    // OpenAI responses that complete successfully are considered successful by default
    return {
      success: true,
      usage,
    };
  }
}
