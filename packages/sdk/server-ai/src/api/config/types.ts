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
export interface LDAIConfigBase {
  /**
   * Optional model configuration.
   */
  model?: LDModelConfig;

  /**
   * Optional configuration for the provider.
   */
  provider?: LDProviderConfig;

  /**
   * Whether the configuration is enabled.
   */
  enabled: boolean;

  /**
   * The mode of the AI Config. Defaults to 'completion' for regular AI Configs.
   * Set to 'judge' for AI Configs that evaluate other AI Configs.
   * Set to 'agent' for AI Config agents.
   */
  mode?: 'completion' | 'agent' | 'judge';

  /**
   * Maps this AI config to a format usable direcly in Vercel AI SDK generateText()
   * and streamText() methods.
   *
   * WARNING: this method can throw an exception if a Vercel AI SDK model cannot be determined.
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
 * Judge-specific AI Config with required evaluation metric key.
 */
export interface LDAIJudgeConfig extends LDAIConfigBase {
  mode: 'judge';
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
export interface LDAIAgentConfig extends LDAIConfigBase {
  mode: 'agent';
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
export interface LDAIConfig extends LDAIConfigBase {
  mode?: 'completion';
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
export type LDAIConfigKind = LDAIConfig | LDAIAgentConfig | LDAIJudgeConfig;

/**
 * Return type for config method - includes both tracker and config.
 */
export interface LDTrackedConfig {
  /** A tracker which can be used to generate analytics. */
  tracker: LDAIConfigTracker;
  /** The AI configuration. */
  config: LDAIConfig;
}

/**
 * Return type for agent method - includes both tracker and agent config.
 */
export interface LDTrackedAgent {
  /** A tracker which can be used to generate analytics. */
  tracker: LDAIConfigTracker;
  /** The agent configuration. */
  agent: LDAIAgentConfig;
}

/**
 * Return type for judge method - includes both tracker and judge config.
 */
export interface LDTrackedJudge {
  /** A tracker which can be used to generate analytics. */
  tracker: LDAIConfigTracker;
  /** The judge configuration. */
  judge: LDAIJudgeConfig;
}

/**
 * Return type for agents method - includes both tracker and agent configs.
 */
export interface LDTrackedAgents {
  /** A tracker which can be used to generate analytics. */
  tracker: LDAIConfigTracker;
  /** Dictionary of agent configurations by key. */
  agents: Record<string, LDAIAgentConfig>;
}

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
  defaultValue: LDAIAgentConfig;

  /**
   * Variables for instructions interpolation.
   */
  variables?: Record<string, unknown>;
}

/**
 * AI Config agent interface (extends agent config without tracker and toVercelAISDK).
 */
export interface LDAIAgent extends Omit<LDAIAgentConfig, 'toVercelAISDK'> {
  /**
   * Instructions for the agent.
   */
  instructions?: string;
}

/**
 * Mode type for AI configurations.
 */
export type Mode = 'completion' | 'agent' | 'judge';

/**
 * Metadata for LaunchDarkly variations.
 */
export interface LDMeta {
  variationKey: string;
  enabled: boolean;
  version?: number;
  mode?: Mode;
}
