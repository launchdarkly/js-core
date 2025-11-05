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
    try {
      const response = await this._client.chat.completions.create({
        model: this._modelName,
        messages,
        ...this._parameters,
      });

      // Generate metrics early (assumes success by default)
      const metrics = OpenAIProvider.getAIMetricsFromResponse(response);

      // Safely extract the first choice content using optional chaining
      const content = response?.choices?.[0]?.message?.content || '';

      if (!content) {
        this.logger?.warn('OpenAI response has no content available');
        metrics.success = false;
      }

      const assistantMessage: LDMessage = {
        role: 'assistant',
        content,
      };

      return {
        message: assistantMessage,
        metrics,
      };
    } catch (error) {
      this.logger?.warn('OpenAI model invocation failed:', error);

      return {
        message: {
          role: 'assistant',
          content: '',
        },
        metrics: {
          success: false,
        },
      };
    }
  }

  /**
   * Invoke the OpenAI model with structured output support.
   */
  async invokeStructuredModel(
    messages: LDMessage[],
    responseStructure: Record<string, unknown>,
  ): Promise<StructuredResponse> {
    let response;
    try {
      response = await this._client.chat.completions.create({
        ...this._parameters,
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
      });
    } catch (error) {
      this.logger?.warn('OpenAI structured model invocation failed:', error);

      return {
        data: {},
        rawResponse: '',
        metrics: {
          success: false,
        },
      };
    }

    // Generate metrics early (assumes success by default)
    const metrics = OpenAIProvider.getAIMetricsFromResponse(response);

    // Safely extract the first choice content using optional chaining
    const content = response?.choices?.[0]?.message?.content || '';

    if (!content) {
      this.logger?.warn('OpenAI structured response has no content available');
      metrics.success = false;
      return {
        data: {},
        rawResponse: '',
        metrics,
      };
    }

    try {
      const data = JSON.parse(content) as Record<string, unknown>;

      return {
        data,
        rawResponse: content,
        metrics,
      };
    } catch (parseError) {
      this.logger?.warn('OpenAI structured response contains invalid JSON:', parseError);
      metrics.success = false;
      return {
        data: {},
        rawResponse: content,
        metrics,
      };
    }
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
   * Get AI metrics from an OpenAI response.
   * This method extracts token usage information and success status from OpenAI responses
   * and returns a LaunchDarkly AIMetrics object.
   *
   * @param response The response from OpenAI chat completions API
   * @returns LDAIMetrics with success status and token usage
   *
   * @example
   * const response = await aiConfig.tracker.trackMetricsOf(
   *   OpenAIProvider.getAIMetricsFromResponse,
   *   () => client.chat.completions.create(config)
   * );
   */
  static getAIMetricsFromResponse(response: any): LDAIMetrics {
    // Extract token usage if available
    let usage: LDTokenUsage | undefined;
    if (response?.usage) {
      const { prompt_tokens, completion_tokens, total_tokens } = response.usage;
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

  /**
   * Create AI metrics information from an OpenAI response.
   * This method extracts token usage information and success status from OpenAI responses
   * and returns a LaunchDarkly AIMetrics object.
   *
   * @deprecated Use `getAIMetricsFromResponse()` instead.
   * @param openaiResponse The response from OpenAI chat completions API
   * @returns LDAIMetrics with success status and token usage
   */
  static createAIMetrics(openaiResponse: any): LDAIMetrics {
    return OpenAIProvider.getAIMetricsFromResponse(openaiResponse);
  }
}
