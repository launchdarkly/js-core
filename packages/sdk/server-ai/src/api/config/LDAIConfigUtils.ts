import {
  LDAIAgentConfig,
  LDAIConfig,
  LDAIConfigKind,
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
   * Converts an AI configuration to a LaunchDarkly flag value format.
   *
   * @param config The AI configuration to convert
   * @returns The flag value structure for LaunchDarkly
   */
  static toFlagValue(config: LDAIConfigKind): LDAIConfigFlagValue {
    return {
      _ldMeta: {
        variationKey: '', // Not available when converting from config
        enabled: config.enabled ?? false,
        mode: config.mode ?? 'completion',
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
   * @returns The appropriate AI configuration type
   */
  static fromFlagValue(flagValue: LDAIConfigFlagValue): LDAIConfigKind {
    // Determine the specific config type based on mode
    // eslint-disable-next-line no-underscore-dangle
    switch (flagValue._ldMeta?.mode) {
      case 'agent':
        return this.toAgentConfig(flagValue);

      case 'judge':
        return this.toJudgeConfig(flagValue);

      case 'completion':
      default:
        return this.toCompletionConfig(flagValue);
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
   * @returns A completion configuration
   */
  static toCompletionConfig(flagValue: LDAIConfigFlagValue): LDAIConfig {
    return {
      ...this._toBaseConfig(flagValue),
      mode: 'completion' as const,
      messages: flagValue.messages,
      judgeConfiguration: flagValue.judgeConfiguration,
    };
  }

  /**
   * Creates an agent config from flag value data.
   *
   * @param flagValue The flag value from LaunchDarkly
   * @returns An agent configuration
   */
  static toAgentConfig(flagValue: LDAIConfigFlagValue): LDAIAgentConfig {
    return {
      ...this._toBaseConfig(flagValue),
      mode: 'agent' as const,
      instructions: flagValue.instructions,
      judgeConfiguration: flagValue.judgeConfiguration,
    };
  }

  /**
   * Creates a judge config from flag value data.
   *
   * @param flagValue The flag value from LaunchDarkly
   * @returns A judge configuration
   */
  static toJudgeConfig(flagValue: LDAIConfigFlagValue): LDAIJudgeConfig {
    if (!flagValue.evaluationMetricKeys || flagValue.evaluationMetricKeys.length === 0) {
      // Return a disabled judge config instead of throwing
      return {
        ...this._toBaseConfig(flagValue),
        enabled: false,
        mode: 'judge' as const,
        messages: flagValue.messages,
        evaluationMetricKeys: [], // Use empty array for disabled config
      };
    }

    return {
      ...this._toBaseConfig(flagValue),
      mode: 'judge' as const,
      messages: flagValue.messages,
      evaluationMetricKeys: flagValue.evaluationMetricKeys,
    };
  }
}
