import { LDAIConfigTracker } from './LDAIConfigTracker';
import { VercelAISDKConfig, VercelAISDKMapOptions, VercelAISDKProvider } from './VercelAISDK';

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
   * The name of the provider.
   */
  name: string;
}

/**
 * Configuration for a single judge attachment.
 */
export interface LDJudge {
  /** The key of the judge AI Config */
  key: string;
  /** Sampling rate for evaluation (0.0 to 1.0) */
  samplingRate: number;
}

/**
 * Configuration for judge attachment to AI Configs.
 */
export interface LDJudgeConfiguration {
  /** Array of judge configurations */
  judges: LDJudge[];
}

/**
 * Base AI Config interface without mode-specific fields.
 */
export interface LDAIConfig extends Omit<LDAIConfigDefault, 'enabled'> {
  /**
   * Whether the configuration is enabled.
   */
  enabled: boolean;

  /**
   * A tracker which can be used to generate analytics.
   * Undefined for disabled configs.
   */
  tracker?: LDAIConfigTracker;

  /**
   * Maps this AI config to a format usable direcly in Vercel AI SDK generateText()
   * and streamText() methods.
   *
   * WARNING: this method can throw an exception if a Vercel AI SDK model cannot be determined.
   *
   * @deprecated Use `VercelProvider.toVercelAISDK()` from the `@launchdarkly/server-sdk-ai-vercel` package instead.
   * This method will be removed in a future version.
   *
   * @param provider A Vercel AI SDK Provider or a map of provider names to Vercel AI SDK Providers.
   * @param options Optional mapping options.
   * @returns A configuration directly usable in Vercel AI SDK generateText() and streamText()
   * @throws {Error} if a Vercel AI SDK model cannot be determined from the given provider parameter.
   */
  toVercelAISDK?: <TMod>(
    provider: VercelAISDKProvider<TMod> | Record<string, VercelAISDKProvider<TMod>>,
    options?: VercelAISDKMapOptions | undefined,
  ) => VercelAISDKConfig<TMod>;
}

/**
 * Base AI Config interface for default implementations with optional enabled property.
 */
export interface LDAIConfigDefault {
  /**
   * Optional model configuration.
   */
  model?: LDModelConfig;

  /**
   * Optional configuration for the provider.
   */
  provider?: LDProviderConfig;

  /**
   * Whether the configuration is enabled. Defaults to false when not provided.
   */
  enabled?: boolean;
}

/**
 * Default implementation types for AI Configs with optional enabled property.
 */

/**
 * Default Judge-specific AI Config with required evaluation metric key.
 */
export interface LDAIJudgeConfigDefault extends LDAIConfigDefault {
  /**
   * Optional prompt data for judge configurations.
   */
  messages?: LDMessage[];
  /**
   * Evaluation metric keys for judge configurations.
   * The keys of the metrics that this judge can evaluate.
   */
  evaluationMetricKeys?: string[];
}

/**
 * Default Agent-specific AI Config with instructions.
 */
export interface LDAIAgentConfigDefault extends LDAIConfigDefault {
  /**
   * Instructions for the agent.
   */
  instructions?: string;
  /**
   * Judge configuration for AI Configs being evaluated.
   * References judge AI Configs that should evaluate this AI Config.
   */
  judgeConfiguration?: LDJudgeConfiguration;
}

/**
 * Default Completion AI Config (default mode).
 */
export interface LDAICompletionConfigDefault extends LDAIConfigDefault {
  /**
   * Optional prompt data for completion configurations.
   */
  messages?: LDMessage[];
  /**
   * Judge configuration for AI Configs being evaluated.
   * References judge AI Configs that should evaluate this AI Config.
   */
  judgeConfiguration?: LDJudgeConfiguration;
}

/**
 * Non-default implementation types for AI Configs with required enabled property and tracker.
 */

/**
 * Judge-specific AI Config with required evaluation metric key.
 */
export interface LDAIJudgeConfig extends LDAIConfig {
  /**
   * Optional prompt data for judge configurations.
   */
  messages?: LDMessage[];
  /**
   * Evaluation metric keys for judge configurations.
   * The keys of the metrics that this judge can evaluate.
   */
  evaluationMetricKeys: string[];
}

/**
 * Agent-specific AI Config with instructions.
 */
export interface LDAIAgentConfig extends LDAIConfig {
  /**
   * Instructions for the agent.
   */
  instructions?: string;
  /**
   * Judge configuration for AI Configs being evaluated.
   * References judge AI Configs that should evaluate this AI Config.
   */
  judgeConfiguration?: LDJudgeConfiguration;
}

/**
 * Completion AI Config (default mode).
 */
export interface LDAICompletionConfig extends LDAIConfig {
  /**
   * Optional prompt data for completion configurations.
   */
  messages?: LDMessage[];
  /**
   * Judge configuration for AI Configs being evaluated.
   * References judge AI Configs that should evaluate this AI Config.
   */
  judgeConfiguration?: LDJudgeConfiguration;
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
 * Union type for all AI Config variants.
 */
export type LDAIConfigKind = LDAICompletionConfig | LDAIAgentConfig | LDAIJudgeConfig;

/**
 * Union type for all default AI Config variants.
 */
export type LDAIConfigDefaultKind =
  | LDAICompletionConfigDefault
  | LDAIAgentConfigDefault
  | LDAIJudgeConfigDefault;

/**
 * Configuration for a single agent request.
 */
export interface LDAIAgentRequestConfig {
  /**
   * The agent key to retrieve.
   */
  key: string;

  /**
   * Default configuration for the agent.
   */
  defaultValue: LDAIAgentConfigDefault;

  /**
   * Variables for instructions interpolation.
   */
  variables?: Record<string, unknown>;
}

/**
 * AI Config agent interface (extends agent config without tracker and toVercelAISDK).
 */
export interface LDAIAgent extends Omit<LDAIAgentConfig, 'toVercelAISDK' | 'tracker'> {
  /**
   * Instructions for the agent.
   */
  instructions?: string;
}

/**
 * Mode type for AI configurations.
 */
export type LDAIConfigMode = 'completion' | 'agent' | 'judge';
