import { LDAIConfigTracker } from './LDAIConfigTracker';
import {
  LDAIAgentConfig,
  LDAIConfigDefaultKind,
  LDAIConversationConfig,
  LDAIJudgeConfig,
  LDJudgeConfiguration,
  LDMessage,
  LDModelConfig,
  LDProviderConfig,
} from './types';

/**
 * Internal flag value structure returned by LaunchDarkly.
 * This represents the raw data structure that LaunchDarkly returns for AI configuration flags.
 *
 * @internal - Not meant for external use
 */
export interface LDAIConfigFlagValue {
  _ldMeta?: {
    variationKey?: string;
    enabled: boolean;
    version?: number;
    mode?: 'completion' | 'agent' | 'judge';
  };
  model?: LDModelConfig;
  messages?: LDMessage[];
  provider?: LDProviderConfig;
  instructions?: string;
  evaluationMetricKeys?: string[];
  judgeConfiguration?: LDJudgeConfiguration;
}

/**
 * Utility class for converting between AI configuration types and LaunchDarkly flag values.
 *
 * @internal - This class and its types are internal implementation details and should not be used by SDK consumers.
 */
export class LDAIConfigUtils {
  /**
   * Converts a default AI configuration to a LaunchDarkly flag value format.
   *
   * @param config The default AI configuration to convert
   * @param mode The mode for the configuration
   * @returns The flag value structure for LaunchDarkly
   */
  static toFlagValue(
    config: LDAIConfigDefaultKind,
    mode: 'completion' | 'agent' | 'judge',
  ): LDAIConfigFlagValue {
    return {
      _ldMeta: {
        variationKey: '', // Not available when converting from config
        enabled: config.enabled ?? false,
        mode,
      },
      model: config.model,
      messages: 'messages' in config ? config.messages : undefined,
      provider: config.provider,
      instructions: 'instructions' in config ? config.instructions : undefined,
      evaluationMetricKeys:
        'evaluationMetricKeys' in config ? config.evaluationMetricKeys : undefined,
      judgeConfiguration: 'judgeConfiguration' in config ? config.judgeConfiguration : undefined,
    };
  }

  /**
   * Converts a LaunchDarkly flag value to the appropriate AI configuration type.
   *
   * @param flagValue The flag value from LaunchDarkly
   * @param tracker The tracker to add to the config
   * @returns The appropriate AI configuration type
   */
  static fromFlagValue(
    flagValue: LDAIConfigFlagValue,
    tracker: LDAIConfigTracker,
  ): LDAIConversationConfig | LDAIAgentConfig | LDAIJudgeConfig {
    // Determine the actual mode from flag value
    // eslint-disable-next-line no-underscore-dangle
    const flagValueMode = flagValue._ldMeta?.mode;

    // Convert to appropriate config type based on actual mode
    switch (flagValueMode) {
      case 'agent':
        return this.toAgentConfig(flagValue, tracker);
      case 'judge':
        return this.toJudgeConfig(flagValue, tracker);
      case 'completion':
      default:
        return this.toCompletionConfig(flagValue, tracker);
    }
  }

  /**
   * Creates a disabled configuration of the specified mode.
   *
   * @param mode The mode for the disabled config
   * @returns A disabled config of the appropriate type
   */
  static createDisabledConfig(
    mode: 'completion' | 'agent' | 'judge',
  ): LDAIConversationConfig | LDAIAgentConfig | LDAIJudgeConfig {
    switch (mode) {
      case 'agent':
        return {
          enabled: false,
          tracker: undefined,
        } as LDAIAgentConfig;
      case 'judge':
        return {
          enabled: false,
          tracker: undefined,
          evaluationMetricKeys: [],
        } as LDAIJudgeConfig;
      case 'completion':
      default:
        // Default to completion config for completion mode or any unexpected mode
        return {
          enabled: false,
          tracker: undefined,
        } as LDAIConversationConfig;
    }
  }

  /**
   * Creates the base configuration that all config types share.
   *
   * @param flagValue The flag value from LaunchDarkly
   * @returns Base configuration object
   */
  private static _toBaseConfig(flagValue: LDAIConfigFlagValue) {
    return {
      // eslint-disable-next-line no-underscore-dangle
      enabled: flagValue._ldMeta?.enabled ?? false,
      model: flagValue.model,
      provider: flagValue.provider,
    };
  }

  /**
   * Creates a completion config from flag value data.
   *
   * @param flagValue The flag value from LaunchDarkly
   * @param tracker The tracker to add to the config
   * @returns A completion configuration
   */
  static toCompletionConfig(
    flagValue: LDAIConfigFlagValue,
    tracker: LDAIConfigTracker,
  ): LDAIConversationConfig {
    return {
      ...this._toBaseConfig(flagValue),
      tracker,
      messages: flagValue.messages,
      judgeConfiguration: flagValue.judgeConfiguration,
    };
  }

  /**
   * Creates an agent config from flag value data.
   *
   * @param flagValue The flag value from LaunchDarkly
   * @param tracker The tracker to add to the config
   * @returns An agent configuration
   */
  static toAgentConfig(
    flagValue: LDAIConfigFlagValue,
    tracker: LDAIConfigTracker,
  ): LDAIAgentConfig {
    return {
      ...this._toBaseConfig(flagValue),
      tracker,
      instructions: flagValue.instructions,
      judgeConfiguration: flagValue.judgeConfiguration,
    };
  }

  /**
   * Creates a judge config from flag value data.
   *
   * @param flagValue The flag value from LaunchDarkly
   * @param tracker The tracker to add to the config
   * @returns A judge configuration
   */
  static toJudgeConfig(
    flagValue: LDAIConfigFlagValue,
    tracker: LDAIConfigTracker,
  ): LDAIJudgeConfig {
    return {
      ...this._toBaseConfig(flagValue),
      tracker,
      messages: flagValue.messages,
      evaluationMetricKeys: flagValue.evaluationMetricKeys || [],
    };
  }
}
