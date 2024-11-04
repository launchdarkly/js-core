import { LDAIConfigTracker } from './LDAIConfigTracker';

/**
 * Configuration related to the model.
 */
export interface LDModelConfig {
  /**
   * The ID of the model.
   */
  modelId?: string;

  /**
   * And additional model specific information.
   */
  [index: string]: unknown;
}

/**
 * Information about prompts.
 */
export interface LDPrompt {
  /**
   * The role of the prompt.
   */
  role: 'user' | 'assistant' | 'system';
  /**
   * Content for the prompt.
   */
  content: string;
}

/**
 * Configuration which affects generation.
 */
export interface LDGenerationConfig {
  /**
   * Optional model configuration.
   */
  model?: LDModelConfig;
  /**
   * Optional prompt data.
   */
  prompt?: LDPrompt[];
}

/**
 * AI Config value and tracker.
 */
export interface LDAIConfig {
  /**
   * The result of the AI Config customization.
   */
  config: LDGenerationConfig;

  /**
   * A tracker which can be used to generate analytics.
   */
  tracker: LDAIConfigTracker;

  /**
   * Whether the configuration is not found.
   */
  noConfiguration: boolean;
}
