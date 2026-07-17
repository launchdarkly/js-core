import { Evaluator } from '../judge/Evaluator';
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
  LDTool,
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
    modelKey?: string;
    modelVersion?: number;
  };
  model?: LDModelConfig;
  messages?: LDMessage[];
  provider?: LDProviderConfig;
  instructions?: string;
  evaluationMetricKey?: string;
  evaluationMetricKeys?: string[];
  judgeConfiguration?: LDJudgeConfiguration;
  tools?: { [toolName: string]: LDTool };
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
    if ('evaluationMetricKey' in config && config.evaluationMetricKey !== undefined) {
      flagValue.evaluationMetricKey = config.evaluationMetricKey;
    }
    if ('judgeConfiguration' in config && config.judgeConfiguration !== undefined) {
      flagValue.judgeConfiguration = config.judgeConfiguration;
    }
    if ('tools' in config && config.tools !== undefined) {
      flagValue.tools = config.tools;
    }

    return flagValue;
  }

  /**
   * Converts a LaunchDarkly flag value to the appropriate AI configuration type.
   *
   * @param key The configuration key
   * @param flagValue The flag value from LaunchDarkly
   * @param trackerFactory A factory function that creates a new tracker for each AI run
   * @param evaluator The evaluator to attach to completion and agent configs
   * @returns The appropriate AI configuration type
   */
  static fromFlagValue(
    key: string,
    flagValue: LDAIConfigFlagValue,
    trackerFactory: () => LDAIConfigTracker,
    evaluator: Evaluator,
  ): LDAIConfigKind {
    // Determine the actual mode from flag value
    // eslint-disable-next-line no-underscore-dangle
    const flagValueMode = flagValue._ldMeta?.mode;

    switch (flagValueMode) {
      case 'agent':
        return this.toAgentConfig(key, flagValue, trackerFactory, evaluator);
      case 'judge':
        return this.toJudgeConfig(key, flagValue, trackerFactory);
      case 'completion':
      default:
        return this.toCompletionConfig(key, flagValue, trackerFactory, evaluator);
    }
  }

  /**
   * Creates a disabled configuration of the specified mode.
   *
   * @param key The configuration key
   * @param mode The mode for the disabled config
   * @param createTracker A factory function that creates a new tracker for each AI run
   * @param evaluator The evaluator to attach to completion and agent configs
   * @returns A disabled config of the appropriate type
   */
  static createDisabledConfig(
    key: string,
    mode: LDAIConfigMode,
    createTracker: () => LDAIConfigTracker,
    evaluator: Evaluator,
  ): LDAIConfigKind {
    switch (mode) {
      case 'agent':
        return {
          key,
          enabled: false,
          createTracker,
          evaluator,
        } as LDAIAgentConfig;
      case 'judge':
        return {
          key,
          enabled: false,
          createTracker,
        } as LDAIJudgeConfig;
      case 'completion':
      default:
        // Default to completion config for completion mode or any unexpected mode
        return {
          key,
          enabled: false,
          createTracker,
          evaluator,
        } as LDAICompletionConfig;
    }
  }

  private static _resolveTools(
    flagValue: LDAIConfigFlagValue,
  ): { [toolName: string]: LDTool } | undefined {
    if (flagValue.tools !== undefined) {
      return flagValue.tools as { [toolName: string]: LDTool } | undefined;
    }

    const rawTools = flagValue.model?.parameters?.['tools'];
    if (!Array.isArray(rawTools)) {
      return undefined;
    }

    const result: { [toolName: string]: LDTool } = {};
    for (const entry of rawTools) {
      const tool = entry as LDTool;
      if (tool?.name) {
        result[tool.name] = tool;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
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
   * @param key The configuration key
   * @param flagValue The flag value from LaunchDarkly
   * @param trackerFactory A factory function that creates a new tracker for each AI run
   * @param evaluator The evaluator for this completion config
   * @returns A completion configuration
   */
  static toCompletionConfig(
    key: string,
    flagValue: LDAIConfigFlagValue,
    trackerFactory: () => LDAIConfigTracker,
    evaluator: Evaluator,
  ): LDAICompletionConfig {
    return {
      ...this._toBaseConfig(key, flagValue),
      createTracker: trackerFactory,
      evaluator,
      messages: flagValue.messages,
      judgeConfiguration: flagValue.judgeConfiguration,
      tools: this._resolveTools(flagValue),
    };
  }

  /**
   * Creates an agent config from flag value data.
   *
   * @param key The configuration key
   * @param flagValue The flag value from LaunchDarkly
   * @param trackerFactory A factory function that creates a new tracker for each AI run
   * @param evaluator The evaluator for this agent config
   * @returns An agent configuration
   */
  static toAgentConfig(
    key: string,
    flagValue: LDAIConfigFlagValue,
    trackerFactory: () => LDAIConfigTracker,
    evaluator: Evaluator,
  ): LDAIAgentConfig {
    return {
      ...this._toBaseConfig(key, flagValue),
      createTracker: trackerFactory,
      evaluator,
      instructions: flagValue.instructions,
      judgeConfiguration: flagValue.judgeConfiguration,
      tools: this._resolveTools(flagValue),
    };
  }

  /**
   * Creates a judge config from flag value data.
   *
   * @param key The configuration key
   * @param flagValue The flag value from LaunchDarkly
   * @param trackerFactory A factory function that creates a new tracker for each AI run
   * @returns A judge configuration
   */
  static toJudgeConfig(
    key: string,
    flagValue: LDAIConfigFlagValue,
    trackerFactory: () => LDAIConfigTracker,
  ): LDAIJudgeConfig {
    // Prioritize evaluationMetricKey, fallback to first valid (non-empty, non-whitespace) value in evaluationMetricKeys
    let evaluationMetricKey: string | undefined;
    if (flagValue.evaluationMetricKey && flagValue.evaluationMetricKey.trim().length > 0) {
      evaluationMetricKey = flagValue.evaluationMetricKey.trim();
    } else if (flagValue.evaluationMetricKeys && flagValue.evaluationMetricKeys.length > 0) {
      const validKey = flagValue.evaluationMetricKeys.find(
        (metricKey) => metricKey && metricKey.trim().length > 0,
      );
      evaluationMetricKey = validKey ? validKey.trim() : undefined;
    }

    return {
      ...this._toBaseConfig(key, flagValue),
      createTracker: trackerFactory,
      messages: flagValue.messages,
      evaluationMetricKey,
    };
  }
}
