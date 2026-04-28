import { LanguageModel } from 'ai';

import type { LDAICompletionConfig, LDAIConfig, LDLogger } from '@launchdarkly/server-sdk-ai';

import type { VercelAIModelParameters } from './types';
import { mapProviderName } from './vercelHelper';
import { VercelModelRunner } from './VercelModelRunner';

/**
 * Factory for creating Vercel AI runners.
 *
 * Vercel ships only a model runner; agent and graph runners are not provided
 * because the Vercel AI SDK is a thin model layer rather than an agent
 * framework.
 */
export class VercelRunnerFactory {
  private _logger?: LDLogger;

  constructor(logger?: LDLogger) {
    this._logger = logger;
  }

  /**
   * Static convenience constructor matching the other provider factories.
   */
  static async create(logger?: LDLogger): Promise<VercelRunnerFactory> {
    return new VercelRunnerFactory(logger);
  }

  /**
   * Create a model runner from a completion AI configuration.
   */
  async createModel(config: LDAICompletionConfig): Promise<VercelModelRunner> {
    const model = await VercelRunnerFactory.createVercelModel(config);
    const parameters = VercelRunnerFactory.mapParameters(config.model?.parameters);
    return new VercelModelRunner(model, parameters, this._logger);
  }

  /**
   * Create a Vercel AI model from an AI configuration.
   * This method auto-detects the provider and creates the model instance.
   */
  static async createVercelModel(aiConfig: LDAIConfig): Promise<LanguageModel> {
    const providerName = mapProviderName(aiConfig.provider?.name || '');
    const modelName = aiConfig.model?.name || '';

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
}
