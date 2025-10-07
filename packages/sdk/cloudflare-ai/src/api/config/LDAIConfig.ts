import type { Ai } from '@cloudflare/workers-types';

import type { LDAIConfigTracker } from './LDAIConfigTracker';

/**
 * Configuration for an AI model.
 */
export interface LDModelConfig {
  /**
   * The Workers AI model identifier as expected by Cloudflare, for example:
   * "@cf/meta/llama-3.3-70b-instruct-fp8-fast".
   */
  name: string;

  /**
   * Model-specific parameters such as temperature, max_tokens, top_p, etc.
   */
  parameters?: { [index: string]: unknown };

  /**
   * Additional user-specified custom parameters.
   */
  custom?: { [index: string]: unknown };
}

/**
 * Configuration for the AI provider.
 */
export interface LDProviderConfig {
  /**
   * The name of the provider (e.g., "cloudflare-workers-ai").
   */
  name: string;
}

/**
 * A message in a conversation or prompt.
 */
export interface LDMessage {
  /**
   * The role of the message sender.
   */
  role: 'user' | 'assistant' | 'system';

  /**
   * The content of the message.
   */
  content: string;
}

/**
 * Options for mapping to Cloudflare Workers AI format.
 */
export interface WorkersAIMapOptions {
  /**
   * Override the model name.
   */
  modelOverride?: string;

  /**
   * Enable streaming responses.
   */
  stream?: boolean;

  /**
   * Additional parameters to merge into the configuration.
   */
  additionalParams?: Record<string, unknown>;
}

/**
 * Configuration format for Cloudflare Workers AI API.
 */
export type WorkersAIConfig = {
  /**
   * The Cloudflare Workers AI model ID.
   */
  model: string;

  /**
   * Messages for chat completion models.
   */
  messages?: Array<{ role: string; content: string }>;

  /**
   * Enable streaming.
   */
  stream?: boolean;

  /**
   * Maximum tokens to generate.
   */
  max_tokens?: number;

  /**
   * Sampling temperature.
   */
  temperature?: number;

  /**
   * Top-p sampling.
   */
  top_p?: number;

  /**
   * Top-k sampling.
   */
  top_k?: number;

  /**
   * Frequency penalty.
   */
  frequency_penalty?: number;

  /**
   * Presence penalty.
   */
  presence_penalty?: number;

  /**
   * Additional parameters.
   */
  [key: string]: unknown;
};

/**
 * AI configuration from LaunchDarkly with tracker and conversion methods.
 */
export interface LDAIConfig {
  /**
   * Model configuration.
   */
  model?: LDModelConfig;

  /**
   * Messages for the model.
   */
  messages?: LDMessage[];

  /**
   * Provider configuration.
   */
  provider?: LDProviderConfig;

  /**
   * Tracker for metrics and analytics.
   */
  tracker: LDAIConfigTracker;

  /**
   * Whether the configuration is enabled.
   */
  enabled: boolean;

  /**
   * Converts this configuration to Cloudflare Workers AI format.
   *
   * @param options Optional mapping options.
   * @returns Configuration ready to use with Cloudflare Workers AI.
   */
  toWorkersAI(binding: Ai, options?: WorkersAIMapOptions): WorkersAIConfig;

  /**
   * Convenience helper that maps to Cloudflare Workers AI config, runs the model via
   * the provided AI binding, and automatically records metrics via the tracker.
   *
   * @param aiBinding The Cloudflare Workers AI binding (env.AI)
   * @param options Optional mapping options for Cloudflare Workers AI
   * @returns Provider-specific response from Workers AI
   */
  // Cloudflare convenience runner is provided separately; no inline runner here.
}

/**
 * Default AI configuration (without tracker and conversion methods).
 */
export type LDAIDefaults = Omit<LDAIConfig, 'tracker' | 'enabled' | 'toWorkersAI'> & {
  /**
   * Whether the configuration is enabled. Defaults to false.
   */
  enabled?: boolean;
};
