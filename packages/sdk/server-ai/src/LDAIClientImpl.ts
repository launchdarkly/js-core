import * as Mustache from 'mustache';

import { LDContext, LDLogger } from '@launchdarkly/js-server-sdk-common';

import { TrackedChat } from './api/chat';
import {
  LDAIAgentConfig,
  LDAIAgentConfigDefault,
  LDAIAgentRequestConfig,
  LDAIConfigDefaultKind,
  LDAIConfigKind,
  LDAIConversationConfig,
  LDAIConversationConfigDefault,
  LDAIJudgeConfig,
  LDAIJudgeConfigDefault,
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
    mode: 'completion' | 'agent' | 'judge',
    variables?: Record<string, unknown>,
  ): Promise<LDAIConfigKind> {
    // Convert default value to LDFlagValue format
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

    // Convert the flag value to the appropriate config type
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

    // Apply variable interpolation to messages if they exist
    if ('messages' in config && config.messages) {
      return {
        ...config,
        messages: config.messages.map((entry: LDMessage) => ({
          ...entry,
          content: this._interpolateTemplate(entry.content, allVariables),
        })),
      };
    }

    // Apply variable interpolation to instructions if they exist
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

  async config(
    key: string,
    context: LDContext,
    defaultValue: LDAIConversationConfigDefault,
    variables?: Record<string, unknown>,
  ): Promise<LDAIConversationConfig> {
    this._ldClient.track('$ld:ai:config:function:single', context, key, 1);

    const config = await this._evaluate(key, context, defaultValue, 'completion', variables);
    return this._addVercelAISDKSupport(config as LDAIConversationConfig);
  }

  async judge(
    key: string,
    context: LDContext,
    defaultValue: LDAIJudgeConfigDefault,
    variables?: Record<string, unknown>,
  ): Promise<LDAIJudgeConfig> {
    this._ldClient.track('$ld:ai:judge:function:single', context, key, 1);

    const config = await this._evaluate(key, context, defaultValue, 'judge', variables);
    return config as LDAIJudgeConfig;
  }

  async agent(
    key: string,
    context: LDContext,
    defaultValue: LDAIAgentConfigDefault,
    variables?: Record<string, unknown>,
  ): Promise<LDAIAgentConfig> {
    // Track agent usage
    this._ldClient.track('$ld:ai:agent:function:single', context, key, 1);

    const config = await this._evaluate(key, context, defaultValue, 'agent', variables);
    return config as LDAIAgentConfig;
  }

  async agents<const T extends readonly LDAIAgentRequestConfig[]>(
    agentConfigs: T,
    context: LDContext,
  ): Promise<Record<T[number]['key'], LDAIAgentConfig>> {
    // Track multiple agents usage
    this._ldClient.track(
      '$ld:ai:agent:function:multiple',
      context,
      agentConfigs.length,
      agentConfigs.length,
    );

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

  async initChat(
    key: string,
    context: LDContext,
    defaultValue: LDAIConversationConfigDefault,
    variables?: Record<string, unknown>,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<TrackedChat | undefined> {
    // Track chat initialization
    this._ldClient.track('$ld:ai:config:function:initChat', context, key, 1);

    const config = await this.config(key, context, defaultValue, variables);

    // Return undefined if the configuration is disabled
    if (!config.enabled || !config.tracker) {
      this._logger?.info(`Chat configuration is disabled: ${key}`);
      return undefined;
    }

    // Create the AIProvider instance
    const provider = await AIProviderFactory.create(config, this._logger, defaultAiProvider);
    if (!provider) {
      return undefined;
    }

    // Create the TrackedChat instance with the provider
    return new TrackedChat(config, config.tracker, provider);
  }

  async initJudge(
    key: string,
    context: LDContext,
    defaultValue: LDAIJudgeConfigDefault,
    variables?: Record<string, unknown>,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<Judge | undefined> {
    // Track judge initialization
    this._ldClient.track('$ld:ai:judge:function:initJudge', context, key, 1);

    try {
      // Retrieve the judge AI Config using the new judge method
      const judgeConfig = await this.judge(key, context, defaultValue, variables);

      // Return undefined if the configuration is disabled
      if (!judgeConfig.enabled || !judgeConfig.tracker) {
        this._logger?.info(`Judge configuration is disabled: ${key}`);
        return undefined;
      }

      // Create the AIProvider instance
      const provider = await AIProviderFactory.create(judgeConfig, this._logger, defaultAiProvider);
      if (!provider) {
        return undefined;
      }

      // Create and return the Judge instance
      return new Judge(judgeConfig, judgeConfig.tracker, provider, this._logger);
    } catch (error) {
      this._logger?.error(`Failed to initialize judge ${key}:`, error);
      return undefined;
    }
  }
}
