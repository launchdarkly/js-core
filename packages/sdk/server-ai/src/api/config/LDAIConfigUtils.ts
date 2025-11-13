import { LDAIConfigTracker } from './LDAIConfigTracker';
import {
  LDAIAgentConfig,
  LDAICompletionConfig,
  LDAIConfigDefaultKind,
  LDAIConfigKind,
  LDAIConfigMode,
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
    mode?: LDAIConfigMode;
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
  static toFlagValue(config: LDAIConfigDefaultKind, mode: LDAIConfigMode): LDAIConfigFlagValue {
    const flagValue: LDAIConfigFlagValue = {
      _ldMeta: {
        variationKey: '', // Not available when converting from config
        enabled: config.enabled ?? false,
        mode,
      },
      model: config.model,
    };

    if ('messages' in config && config.messages !== undefined) {
      flagValue.messages = config.messages;
    }
    if (config.provider !== undefined) {
      flagValue.provider = config.provider;
    }
    if ('instructions' in config && config.instructions !== undefined) {
      flagValue.instructions = config.instructions;
    }
    if ('evaluationMetricKeys' in config && config.evaluationMetricKeys !== undefined) {
      flagValue.evaluationMetricKeys = config.evaluationMetricKeys;
    }
    if ('judgeConfiguration' in config && config.judgeConfiguration !== undefined) {
      flagValue.judgeConfiguration = config.judgeConfiguration;
    }

    return flagValue;
  }

  /**
   * Converts a LaunchDarkly flag value to the appropriate AI configuration type.
   *
   * @param flagValue The flag value from LaunchDarkly
   * @param tracker The tracker to add to the config
   * @returns The appropriate AI configuration type
   */
  static fromFlagValue(
    key: string,
    flagValue: LDAIConfigFlagValue,
    tracker: LDAIConfigTracker,
  ): LDAIConfigKind {
    // Determine the actual mode from flag value
    // eslint-disable-next-line no-underscore-dangle
    const flagValueMode = flagValue._ldMeta?.mode;

    switch (flagValueMode) {
      case 'agent':
        return this.toAgentConfig(key, flagValue, tracker);
      case 'judge':
        return this.toJudgeConfig(key, flagValue, tracker);
      case 'completion':
      default:
        return this.toCompletionConfig(key, flagValue, tracker);
    }
  }

  /**
   * Creates a disabled configuration of the specified mode.
   *
   * @param mode The mode for the disabled config
   * @returns A disabled config of the appropriate type
   */
  static createDisabledConfig(key: string, mode: LDAIConfigMode): LDAIConfigKind {
    switch (mode) {
      case 'agent':
        return {
          key,
          enabled: false,
          tracker: undefined,
        } as LDAIAgentConfig;
      case 'judge':
        return {
          key,
          enabled: false,
          tracker: undefined,
          evaluationMetricKeys: [],
        } as LDAIJudgeConfig;
      case 'completion':
      default:
        // Default to completion config for completion mode or any unexpected mode
        return {
          key,
          enabled: false,
          tracker: undefined,
        } as LDAICompletionConfig;
    }
  }

  /**
   * Creates the base configuration that all config types share.
   *
   * @param flagValue The flag value from LaunchDarkly
   * @returns Base configuration object
   */
  private static _toBaseConfig(key: string, flagValue: LDAIConfigFlagValue) {
    return {
      key,
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
    key: string,
    flagValue: LDAIConfigFlagValue,
    tracker: LDAIConfigTracker,
  ): LDAICompletionConfig {
    return {
      ...this._toBaseConfig(key, flagValue),
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
    key: string,
    flagValue: LDAIConfigFlagValue,
    tracker: LDAIConfigTracker,
  ): LDAIAgentConfig {
    return {
      ...this._toBaseConfig(key, flagValue),
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
    key: string,
    flagValue: LDAIConfigFlagValue,
    tracker: LDAIConfigTracker,
  ): LDAIJudgeConfig {
    return {
      ...this._toBaseConfig(key, flagValue),
      tracker,
      messages: flagValue.messages,
      evaluationMetricKeys: flagValue.evaluationMetricKeys || [],
    };
  }
}
