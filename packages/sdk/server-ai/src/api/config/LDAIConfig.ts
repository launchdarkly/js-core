import { LDAIConfigTracker } from './LDAIConfigTracker';

/**
 * Configuration related to the model.
 */
export interface LDModelConfig {
  /**
   * The ID of the model.
   */
  modelId: string;

  /**
   * Tuning parameter for randomness versus determinism. Exact effect will be determined by the
   * model.
   */
  temperature?: number;

  /**
   * The maximum number of tokens.
   */
  maxTokens?: number;

  /**
   * And additional model specific information.
   */
  [index: string]: unknown;
}

/**
 * Information about prompts.
 */
export interface LDMessage {
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
  prompt?: LDMessage[];
}

/**
 * AI configuration and tracker.
 */
export interface LDAIConfig {
  /**
   * Optional model configuration.
   */
  model?: LDModelConfig;
  /**
   * Optional prompt data.
   */
  prompt?: LDMessage[];

  /**
   * A tracker which can be used to generate analytics.
   */
  tracker: LDAIConfigTracker;

  /**
   * Whether the configuration is enabled.
   */
  enabled: boolean;
}

/**
 * Default value for a `modelConfig`. This is the same as the LDAIConfig, but it does not include
 * a tracker.
 */
export type LDAIDefaults = Omit<LDAIConfig, 'tracker'>
