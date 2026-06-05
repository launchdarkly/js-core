import type { Evaluator } from '../judge/Evaluator';
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

  /**
   * The region for the model.
   */
  region?: string;
}

export interface LDProviderConfig {
  /**
   * The name of the provider.
   */
  name: string;
}

// ============================================================================
// Tool Types
// ============================================================================

/**
 * Configuration for a single tool entry in the root-level tools map.
 * Separate from model.parameters.tools[] which is the LLM-passable array.
 */
export interface LDTool {
  name: string;
  description?: string;
  type?: string;
  parameters?: { [index: string]: unknown };
  customParameters?: { [index: string]: unknown };
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
 * Base AI Config for default implementations with optional enabled property.
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
   * Creates a new tracker for a fresh AI run. Each call mints a new runId (a
   * UUIDv4) that LaunchDarkly uses to correlate the run's events in metrics
   * views. Call this once per AI run; metrics from different runIds cannot be
   * combined.
   */
  createTracker: () => LDAIConfigTracker;
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
  /**
   * Root-level tools map keyed by tool name. Distinct from model.parameters.tools[].
   */
  tools?: { [toolName: string]: LDTool };
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
  /**
   * Root-level tools map keyed by tool name. Distinct from model.parameters.tools[].
   */
  tools?: { [toolName: string]: LDTool };
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
  /**
   * Root-level tools map keyed by tool name. Distinct from model.parameters.tools[].
   */
  tools?: { [toolName: string]: LDTool };
  /**
   * Evaluator for this agent config. Populated at evaluation time.
   * Not part of the flag value shape.
   *
   * @internal
   */
  evaluator: Evaluator;
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
  /**
   * Root-level tools map keyed by tool name. Distinct from model.parameters.tools[].
   */
  tools?: { [toolName: string]: LDTool };
  /**
   * Evaluator for this completion config. Populated at evaluation time.
   * Not part of the flag value shape.
   *
   * @internal
   */
  evaluator: Evaluator;
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
   * Default configuration for the agent. When omitted or null, a disabled default is used.
   */
  defaultValue?: LDAIAgentConfigDefault;

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
