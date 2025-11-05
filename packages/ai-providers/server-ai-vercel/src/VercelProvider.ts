import { generateObject, generateText, jsonSchema, LanguageModel } from 'ai';

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

import type {
  ModelUsageTokens,
  StreamResponse,
  TextResponse,
  VercelAIModelParameters,
  VercelAISDKConfig,
  VercelAISDKMapOptions,
  VercelAISDKProvider,
} from './types';

/**
 * Vercel AI implementation of AIProvider.
 * This provider integrates Vercel AI SDK with LaunchDarkly's tracking capabilities.
 */
export class VercelProvider extends AIProvider {
  private _model: LanguageModel;
  private _parameters: VercelAIModelParameters;

  /**
   * Constructor for the VercelProvider.
   * @param model - The Vercel AI model to use.
   * @param parameters - The Vercel AI model parameters.
   * @param logger - The logger to use for the Vercel AI provider.
   */
  constructor(model: LanguageModel, parameters: VercelAIModelParameters, logger?: LDLogger) {
    super(logger);
    this._model = model;
    this._parameters = parameters;
  }

  // =============================================================================
  // MAIN FACTORY METHODS
  // =============================================================================

  /**
   * Static factory method to create a Vercel AIProvider from an AI configuration.
   * This method auto-detects the provider and creates the model.
   * Note: Messages from the AI config are not included in the provider - messages
   * should be passed at invocation time via invokeModel().
   *
   * @param aiConfig The LaunchDarkly AI configuration
   * @param logger Optional logger
   * @returns A Promise that resolves to a configured VercelProvider
   */
  static async create(aiConfig: LDAIConfig, logger?: LDLogger): Promise<VercelProvider> {
    const model = await VercelProvider.createVercelModel(aiConfig);
    const parameters = VercelProvider.mapParameters(aiConfig.model?.parameters);
    return new VercelProvider(model, parameters, logger);
  }

  // =============================================================================
  // INSTANCE METHODS (AIProvider Implementation)
  // =============================================================================

  /**
   * Invoke the Vercel AI model with an array of messages.
   */
  async invokeModel(messages: LDMessage[]): Promise<ChatResponse> {
    try {
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
      const metrics = VercelProvider.getAIMetricsFromResponse(result);

      return {
        message: assistantMessage,
        metrics,
      };
    } catch (error) {
      this.logger?.warn('Vercel AI model invocation failed:', error);

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
   * Invoke the Vercel AI model with structured output support.
   */
  async invokeStructuredModel(
    messages: LDMessage[],
    responseStructure: Record<string, unknown>,
  ): Promise<StructuredResponse> {
    try {
      const result = await generateObject({
        model: this._model,
        messages,
        schema: jsonSchema(responseStructure),
        ...this._parameters,
      });

      const metrics = VercelProvider.createAIMetrics(result);

      return {
        data: result.object as Record<string, unknown>,
        rawResponse: JSON.stringify(result.object),
        metrics,
      };
    } catch (error) {
      this.logger?.warn('Vercel AI structured model invocation failed:', error);

      return {
        data: {},
        rawResponse: '',
        metrics: {
          success: false,
        },
      };
    }
  }

  /**
   * Get the underlying Vercel AI model instance.
   */
  getModel(): LanguageModel {
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
   * Map Vercel AI SDK usage data to LaunchDarkly token usage.
   *
   * @param usageData Usage data from Vercel AI SDK
   * @returns LDTokenUsage
   */
  static mapUsageDataToLDTokenUsage(usageData: ModelUsageTokens): LDTokenUsage {
    // Support v4 field names (promptTokens, completionTokens) for backward compatibility
    const { totalTokens, inputTokens, outputTokens, promptTokens, completionTokens } = usageData;
    return {
      total: totalTokens ?? 0,
      input: inputTokens ?? promptTokens ?? 0,
      output: outputTokens ?? completionTokens ?? 0,
    };
  }

  /**
   * Get AI metrics from a Vercel AI SDK text response
   * This method extracts token usage information and success status from Vercel AI responses
   * and returns a LaunchDarkly AIMetrics object.
   * Supports both v4 and v5 field names for backward compatibility.
   *
   * @param response The response from generateText() or similar non-streaming operations
   * @returns LDAIMetrics with success status and token usage
   *
   * @example
   * const response = await aiConfig.tracker.trackMetricsOf(
   *   VercelProvider.getAIMetricsFromResponse,
   *   () => generateText(vercelConfig)
   * );
   */
  static getAIMetricsFromResponse(response: TextResponse): LDAIMetrics {
    const finishReason = response?.finishReason ?? 'unknown';

    // favor totalUsage over usage for cumulative usage across all steps
    let usage: LDTokenUsage | undefined;
    if (response?.totalUsage) {
      usage = VercelProvider.mapUsageDataToLDTokenUsage(response.totalUsage);
    } else if (response?.usage) {
      usage = VercelProvider.mapUsageDataToLDTokenUsage(response.usage);
    }

    const success = finishReason !== 'error';

    return {
      success,
      usage,
    };
  }

  /**
   * Create AI metrics information from a Vercel AI response.
   * This method extracts token usage information and success status from Vercel AI responses
   * and returns a LaunchDarkly AIMetrics object.
   * Supports both v4 and v5 field names for backward compatibility.
   *
   * @deprecated Use `getAIMetricsFromResponse()` instead.
   * @param vercelResponse The response from generateText() or similar non-streaming operations
   * @returns LDAIMetrics with success status and token usage
   */
  static createAIMetrics(vercelResponse: TextResponse): LDAIMetrics {
    return VercelProvider.getAIMetricsFromResponse(vercelResponse);
  }

  /**
   * Get AI metrics from a Vercel AI SDK streaming result.
   *
   * This method waits for the stream to complete, then extracts metrics using totalUsage
   * (preferred for cumulative usage across all steps) or usage if totalUsage is unavailable.
   *
   * @param stream The stream result from streamText()
   * @returns A Promise that resolves to LDAIMetrics
   *
   * @example
   * const stream = aiConfig.tracker.trackStreamMetricsOf(
   *   () => streamText(vercelConfig),
   *   VercelProvider.getAIMetricsFromStream
   * );
   */
  static async getAIMetricsFromStream(stream: StreamResponse): Promise<LDAIMetrics> {
    const finishReason = (await stream.finishReason?.catch(() => 'error')) ?? 'unknown';

    // favor totalUsage over usage for cumulative usage across all steps
    let usage: LDTokenUsage | undefined;
    if (stream.totalUsage) {
      const usageData = await stream.totalUsage;
      usage = VercelProvider.mapUsageDataToLDTokenUsage(usageData);
    } else if (stream.usage) {
      const usageData = await stream.usage;
      usage = VercelProvider.mapUsageDataToLDTokenUsage(usageData);
    }

    const success = finishReason !== 'error';

    return {
      success,
      usage,
    };
  }

  /**
   * Map LaunchDarkly model parameters to Vercel AI SDK parameters.
   *
   * Parameter mappings:
   * - max_tokens → maxTokens
   * - max_completion_tokens → maxOutputTokens
   * - temperature → temperature
   * - top_p → topP
   * - top_k → topK
   * - presence_penalty → presencePenalty
   * - frequency_penalty → frequencyPenalty
   * - stop → stopSequences
   * - seed → seed
   *
   * @param parameters The LaunchDarkly model parameters to map
   * @returns An object containing mapped Vercel AI SDK parameters
   */
  static mapParameters(parameters?: { [index: string]: unknown }): VercelAIModelParameters {
    if (!parameters) {
      return {};
    }

    const params: VercelAIModelParameters = {};

    if (parameters.max_tokens !== undefined) {
      params.maxTokens = parameters.max_tokens as number;
    }
    if (parameters.max_completion_tokens !== undefined) {
      params.maxOutputTokens = parameters.max_completion_tokens as number;
    }
    if (parameters.temperature !== undefined) {
      params.temperature = parameters.temperature as number;
    }
    if (parameters.top_p !== undefined) {
      params.topP = parameters.top_p as number;
    }
    if (parameters.top_k !== undefined) {
      params.topK = parameters.top_k as number;
    }
    if (parameters.presence_penalty !== undefined) {
      params.presencePenalty = parameters.presence_penalty as number;
    }
    if (parameters.frequency_penalty !== undefined) {
      params.frequencyPenalty = parameters.frequency_penalty as number;
    }
    if (parameters.stop !== undefined) {
      params.stopSequences = parameters.stop as string[];
    }
    if (parameters.seed !== undefined) {
      params.seed = parameters.seed as number;
    }

    return params;
  }

  /**
   * Convert an AI configuration to Vercel AI SDK parameters.
   * This static method allows converting an LDAIConfig to VercelAISDKConfig without
   * requiring an instance of VercelProvider.
   *
   * @param aiConfig The LaunchDarkly AI configuration
   * @param provider A Vercel AI SDK Provider or a map of provider names to Vercel AI SDK Providers
   * @param options Optional mapping options
   * @returns A configuration directly usable in Vercel AI SDK generateText() and streamText()
   * @throws {Error} if a Vercel AI SDK model cannot be determined from the given provider parameter
   */
  static toVercelAISDK<TMod>(
    aiConfig: LDAIConfig,
    provider: VercelAISDKProvider<TMod> | Record<string, VercelAISDKProvider<TMod>>,
    options?: VercelAISDKMapOptions | undefined,
  ): VercelAISDKConfig<TMod> {
    // Determine the model from the provider
    let model: TMod | undefined;
    if (typeof provider === 'function') {
      model = provider(aiConfig.model?.name ?? '');
    } else {
      model = provider[aiConfig.provider?.name ?? '']?.(aiConfig.model?.name ?? '');
    }
    if (!model) {
      throw new Error(
        'Vercel AI SDK model cannot be determined from the supplied provider parameter.',
      );
    }

    // Merge messages from config and options
    let messages: LDMessage[] | undefined;
    const configMessages = ('messages' in aiConfig ? aiConfig.messages : undefined) as
      | LDMessage[]
      | undefined;
    if (configMessages || options?.nonInterpolatedMessages) {
      messages = [...(configMessages ?? []), ...(options?.nonInterpolatedMessages ?? [])];
    }

    // Map parameters using the shared mapping method
    const params = VercelProvider.mapParameters(aiConfig.model?.parameters);

    // Build and return the Vercel AI SDK configuration
    return {
      model,
      messages,
      ...params,
    };
  }

  /**
   * Create a Vercel AI model from an AI configuration.
   * This method auto-detects the provider and creates the model instance.
   *
   * @param aiConfig The LaunchDarkly AI configuration
   * @returns A Promise that resolves to a configured Vercel AI model
   */
  static async createVercelModel(aiConfig: LDAIConfig): Promise<LanguageModel> {
    const providerName = VercelProvider.mapProvider(aiConfig.provider?.name || '');
    const modelName = aiConfig.model?.name || '';

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
          const { anthropic } = await import('@ai-sdk/anthropic');
          return anthropic(modelName);
        } catch (error) {
          throw new Error(`Failed to load @ai-sdk/anthropic: ${error}`);
        }
      case 'google':
        try {
          const { google } = await import('@ai-sdk/google');
          return google(modelName);
        } catch (error) {
          throw new Error(`Failed to load @ai-sdk/google: ${error}`);
        }
      case 'cohere':
        try {
          const { cohere } = await import('@ai-sdk/cohere');
          return cohere(modelName);
        } catch (error) {
          throw new Error(`Failed to load @ai-sdk/cohere: ${error}`);
        }
      case 'mistral':
        try {
          const { mistral } = await import('@ai-sdk/mistral');
          return mistral(modelName);
        } catch (error) {
          throw new Error(`Failed to load @ai-sdk/mistral: ${error}`);
        }
      default:
        throw new Error(`Unsupported Vercel AI provider: ${providerName}`);
    }
  }
}
