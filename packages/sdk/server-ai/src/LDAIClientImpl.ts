import * as Mustache from 'mustache';

import { LDContext, LDLogger } from '@launchdarkly/js-server-sdk-common';

import { TrackedChat } from './api/chat';
import {
  LDAIAgentConfig,
  LDAIAgentConfigDefault,
  LDAIAgentRequestConfig,
  LDAIConfigDefaultKind,
  LDAIConfigKind,
  LDAIConfigMode,
  LDAIConversationConfig,
  LDAIConversationConfigDefault,
  LDAIJudgeConfig,
  LDAIJudgeConfigDefault,
  LDJudge,
  LDMessage,
  VercelAISDKConfig,
  VercelAISDKMapOptions,
  VercelAISDKProvider,
} from './api/config';
import { LDAIConfigFlagValue, LDAIConfigUtils } from './api/config/LDAIConfigUtils';
import { Judge } from './api/judge/Judge';
import { LDAIClient } from './api/LDAIClient';
import { AIProviderFactory, SupportedAIProvider } from './api/providers';
import { LDAIConfigMapper } from './LDAIConfigMapper';
import { LDAIConfigTrackerImpl } from './LDAIConfigTrackerImpl';
import { LDClientMin } from './LDClientMin';

/**
 * Tracking event keys for AI SDK usage metrics.
 */
const TRACK_CONFIG_SINGLE = '$ld:ai:config:function:single';
const TRACK_CONFIG_CREATE_CHAT = '$ld:ai:config:function:createChat';
const TRACK_JUDGE_SINGLE = '$ld:ai:judge:function:single';
const TRACK_JUDGE_CREATE = '$ld:ai:judge:function:createJudge';
const TRACK_AGENT_SINGLE = '$ld:ai:agent:function:single';
const TRACK_AGENT_MULTIPLE = '$ld:ai:agent:function:multiple';

export class LDAIClientImpl implements LDAIClient {
  private _logger?: LDLogger;

  constructor(private _ldClient: LDClientMin) {
    this._logger = _ldClient.logger;
  }

  private _interpolateTemplate(template: string, variables: Record<string, unknown>): string {
    return Mustache.render(template, variables, undefined, { escape: (item: any) => item });
  }

  private async _evaluate(
    key: string,
    context: LDContext,
    defaultValue: LDAIConfigDefaultKind,
    mode: LDAIConfigMode,
    variables?: Record<string, unknown>,
  ): Promise<LDAIConfigKind> {
    const ldFlagValue = LDAIConfigUtils.toFlagValue(defaultValue, mode);

    const value: LDAIConfigFlagValue = await this._ldClient.variation(key, context, ldFlagValue);

    // Validate mode match
    // eslint-disable-next-line no-underscore-dangle
    const flagMode = value._ldMeta?.mode;
    if (flagMode !== mode) {
      this._logger?.warn(
        `AI Config mode mismatch for ${key}: expected ${mode}, got ${flagMode}. Returning disabled config.`,
      );
      return LDAIConfigUtils.createDisabledConfig(mode);
    }

    const tracker = new LDAIConfigTrackerImpl(
      this._ldClient,
      key,
      // eslint-disable-next-line no-underscore-dangle
      value._ldMeta?.variationKey ?? '',
      // eslint-disable-next-line no-underscore-dangle
      value._ldMeta?.version ?? 1,
      value.model?.name ?? '',
      value.provider?.name ?? '',
      context,
    );

    const config = LDAIConfigUtils.fromFlagValue(value, tracker);

    // Apply variable interpolation (always needed for ldctx)
    return this._applyInterpolation(config, context, variables);
  }

  private _applyInterpolation(
    config: LDAIConversationConfig | LDAIAgentConfig | LDAIJudgeConfig,
    context: LDContext,
    variables?: Record<string, unknown>,
  ): LDAIConversationConfig | LDAIAgentConfig | LDAIJudgeConfig {
    const allVariables = { ...variables, ldctx: context };

    if ('messages' in config && config.messages) {
      return {
        ...config,
        messages: config.messages.map((entry: LDMessage) => ({
          ...entry,
          content: this._interpolateTemplate(entry.content, allVariables),
        })),
      };
    }

    if ('instructions' in config && config.instructions) {
      return {
        ...config,
        instructions: this._interpolateTemplate(config.instructions, allVariables),
      };
    }

    return config;
  }

  private _addVercelAISDKSupport(config: LDAIConversationConfig): LDAIConversationConfig {
    const { messages } = config;
    const mapper = new LDAIConfigMapper(config.model, config.provider, messages);

    return {
      ...config,
      toVercelAISDK: <TMod>(
        sdkProvider: VercelAISDKProvider<TMod> | Record<string, VercelAISDKProvider<TMod>>,
        options?: VercelAISDKMapOptions | undefined,
      ): VercelAISDKConfig<TMod> => mapper.toVercelAISDK(sdkProvider, options),
    };
  }

  private async _initializeJudges(
    judgeConfigs: LDJudge[],
    context: LDContext,
    variables?: Record<string, unknown>,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<Record<string, Judge>> {
    const judges: Record<string, Judge> = {};

    const judgePromises = judgeConfigs.map(async (judgeConfig) => {
      const judge = await this.createJudge(
        judgeConfig.key,
        context,
        { enabled: false },
        variables,
        defaultAiProvider,
      );
      return judge ? { key: judgeConfig.key, judge } : null;
    });

    const results = await Promise.all(judgePromises);
    results.forEach((result) => {
      if (result) {
        judges[result.key] = result.judge;
      }
    });

    return judges;
  }

  async completionConfig(
    key: string,
    context: LDContext,
    defaultValue: LDAIConversationConfigDefault,
    variables?: Record<string, unknown>,
  ): Promise<LDAIConversationConfig> {
    this._ldClient.track(TRACK_CONFIG_SINGLE, context, key, 1);

    const config = await this._evaluate(key, context, defaultValue, 'completion', variables);
    return this._addVercelAISDKSupport(config as LDAIConversationConfig);
  }

  /**
   * @deprecated Use `completionConfig` instead. This method will be removed in a future version.
   */
  async config(
    key: string,
    context: LDContext,
    defaultValue: LDAIConversationConfigDefault,
    variables?: Record<string, unknown>,
  ): Promise<LDAIConversationConfig> {
    return this.completionConfig(key, context, defaultValue, variables);
  }

  async judgeConfig(
    key: string,
    context: LDContext,
    defaultValue: LDAIJudgeConfigDefault,
    variables?: Record<string, unknown>,
  ): Promise<LDAIJudgeConfig> {
    this._ldClient.track(TRACK_JUDGE_SINGLE, context, key, 1);

    const config = await this._evaluate(key, context, defaultValue, 'judge', variables);
    return config as LDAIJudgeConfig;
  }

  async agentConfig(
    key: string,
    context: LDContext,
    defaultValue: LDAIAgentConfigDefault,
    variables?: Record<string, unknown>,
  ): Promise<LDAIAgentConfig> {
    this._ldClient.track(TRACK_AGENT_SINGLE, context, key, 1);

    const config = await this._evaluate(key, context, defaultValue, 'agent', variables);
    return config as LDAIAgentConfig;
  }

  /**
   * @deprecated Use `agentConfig` instead. This method will be removed in a future version.
   */
  async agent(
    key: string,
    context: LDContext,
    defaultValue: LDAIAgentConfigDefault,
    variables?: Record<string, unknown>,
  ): Promise<LDAIAgentConfig> {
    return this.agentConfig(key, context, defaultValue, variables);
  }

  async agentConfigs<const T extends readonly LDAIAgentRequestConfig[]>(
    agentConfigs: T,
    context: LDContext,
  ): Promise<Record<T[number]['key'], LDAIAgentConfig>> {
    this._ldClient.track(TRACK_AGENT_MULTIPLE, context, agentConfigs.length, agentConfigs.length);

    const agents = {} as Record<T[number]['key'], LDAIAgentConfig>;

    await Promise.all(
      agentConfigs.map(async (config) => {
        const agent = await this._evaluate(
          config.key,
          context,
          config.defaultValue,
          'agent',
          config.variables,
        );
        agents[config.key as T[number]['key']] = agent as LDAIAgentConfig;
      }),
    );

    return agents;
  }

  /**
   * @deprecated Use `agentConfigs` instead. This method will be removed in a future version.
   */
  async agents<const T extends readonly LDAIAgentRequestConfig[]>(
    agentConfigs: T,
    context: LDContext,
  ): Promise<Record<T[number]['key'], LDAIAgentConfig>> {
    return this.agentConfigs(agentConfigs, context);
  }

  async createChat(
    key: string,
    context: LDContext,
    defaultValue: LDAIConversationConfigDefault,
    variables?: Record<string, unknown>,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<TrackedChat | undefined> {
    this._ldClient.track(TRACK_CONFIG_CREATE_CHAT, context, key, 1);

    const config = await this.completionConfig(key, context, defaultValue, variables);

    if (!config.enabled || !config.tracker) {
      this._logger?.info(`Chat configuration is disabled: ${key}`);
      return undefined;
    }

    const provider = await AIProviderFactory.create(config, this._logger, defaultAiProvider);
    if (!provider) {
      return undefined;
    }

    const judges = await this._initializeJudges(
      config.judgeConfiguration?.judges ?? [],
      context,
      variables,
      defaultAiProvider,
    );

    return new TrackedChat(config, config.tracker, provider, judges, this._logger);
  }

  async createJudge(
    key: string,
    context: LDContext,
    defaultValue: LDAIJudgeConfigDefault,
    variables?: Record<string, unknown>,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<Judge | undefined> {
    this._ldClient.track(TRACK_JUDGE_CREATE, context, key, 1);

    try {
      if (variables?.message_history !== undefined) {
        this._logger?.warn(
          "The variable 'message_history' is reserved by the judge and will be ignored.",
        );
      }
      if (variables?.response_to_evaluate !== undefined) {
        this._logger?.warn(
          "The variable 'response_to_evaluate' is reserved by the judge and will be ignored.",
        );
      }

      // Overwrite reserved variables to ensure they remain as placeholders for judge evaluation
      const extendedVariables = {
        ...variables,
        message_history: '{{message_history}}',
        response_to_evaluate: '{{response_to_evaluate}}',
      };

      const judgeConfig = await this.judgeConfig(key, context, defaultValue, extendedVariables);

      if (!judgeConfig.enabled || !judgeConfig.tracker) {
        this._logger?.info(`Judge configuration is disabled: ${key}`);
        return undefined;
      }

      const provider = await AIProviderFactory.create(judgeConfig, this._logger, defaultAiProvider);
      if (!provider) {
        return undefined;
      }

      return new Judge(judgeConfig, judgeConfig.tracker, provider, this._logger);
    } catch (error) {
      this._logger?.error(`Failed to initialize judge ${key}:`, error);
      return undefined;
    }
  }

  /**
   * @deprecated Use `createChat` instead. This method will be removed in a future version.
   */
  async initChat(
    key: string,
    context: LDContext,
    defaultValue: LDAIConversationConfigDefault,
    variables?: Record<string, unknown>,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<TrackedChat | undefined> {
    return this.createChat(key, context, defaultValue, variables, defaultAiProvider);
  }
}
