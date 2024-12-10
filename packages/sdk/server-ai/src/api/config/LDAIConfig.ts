import { LDAIConfigTracker } from './LDAIConfigTracker';

/**
 * Configuration related to the model.
 */
export interface LDModelConfig {
  /**
   * The ID of the model.
   */
  name: string;

  /**
   * Model specific parameters.
   */
  parameters?: { [index: string]: unknown };

  /**
   * Additional user-specified parameters.
   */
  custom?: { [index: string]: unknown };
}

export interface LDProviderConfig {
  /**
   * The ID of the provider.
   */
  name: string;
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
  messages?: LDMessage[];

  /**
   * Optional configuration for the provider.
   */
  provider?: LDProviderConfig;

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
 * a tracker and `enabled` is optional.
 */
export type LDAIDefaults = Omit<LDAIConfig, 'tracker' | 'enabled'> & {
  /**
   * Whether the configuration is enabled.
   *
   * defaults to false
   */
  enabled?: boolean;
};
