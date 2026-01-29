import { LDAIConfigTracker } from './LDAIConfigTracker';

// ============================================================================
// Foundation Types
// ============================================================================

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

// ============================================================================
// Judge Types
// ============================================================================

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

// ============================================================================
// Base AI Config Types
// ============================================================================

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
 * Base AI Config interface without mode-specific fields.
 */
export interface LDAIConfig extends Omit<LDAIConfigDefault, 'enabled'> {
  /**
   * The key of the AI Config.
   */
  key: string;
  /**
   * Whether the configuration is enabled.
   */
  enabled: boolean;

  /**
   * A tracker which can be used to generate analytics.
   * Undefined for disabled configs.
   */
  tracker?: LDAIConfigTracker;
}

// ============================================================================
// Default AI Config Implementation Types
// ============================================================================

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
 * Default Judge-specific AI Config with required evaluation metric key.
 */
export interface LDAIJudgeConfigDefault extends LDAIConfigDefault {
  /**
   * Optional prompt data for judge configurations.
   */
  messages?: LDMessage[];
  /**
   * Evaluation metric key for judge configurations.
   * The key of the metric that this judge can evaluate.
   */
  evaluationMetricKey?: string;
  /**
   * Evaluation metric keys for judge configurations (legacy).
   * The keys of the metrics that this judge can evaluate.
   * @deprecated Use evaluationMetricKey instead. This field is kept for legacy support.
   */
  evaluationMetricKeys?: string[];
}

/**
 * Union type for all default AI Config variants.
 */
export type LDAIConfigDefaultKind =
  | LDAIAgentConfigDefault
  | LDAICompletionConfigDefault
  | LDAIJudgeConfigDefault;

// ============================================================================
// AI Config Implementation Types
// ============================================================================

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
 * Judge-specific AI Config with required evaluation metric key.
 */
export interface LDAIJudgeConfig extends LDAIConfig {
  /**
   * Optional prompt data for judge configurations.
   */
  messages?: LDMessage[];
  /**
   * Evaluation metric key for judge configurations.
   * The key of the metric that this judge can evaluate.
   */
  evaluationMetricKey?: string;
  /**
   * Evaluation metric keys for judge configurations (legacy).
   * The keys of the metrics that this judge can evaluate.
   * @deprecated Use evaluationMetricKey instead. This field is kept for legacy support.
   */
  evaluationMetricKeys?: string[];
}

// ============================================================================
// Union Types
// ============================================================================

/**
 * Union type for all AI Config variants.
 */
export type LDAIConfigKind = LDAIAgentConfig | LDAICompletionConfig | LDAIJudgeConfig;

// ============================================================================
// Agent-Specific Request Type
// ============================================================================

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

// ============================================================================
// Mode Type
// ============================================================================

/**
 * Mode type for AI configurations.
 */
export type LDAIConfigMode = 'completion' | 'agent' | 'judge';
