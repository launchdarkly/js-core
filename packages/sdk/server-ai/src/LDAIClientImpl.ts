import * as Mustache from 'mustache';

import { LDContext, LDLogger } from '@launchdarkly/js-server-sdk-common';

import { TrackedChat } from './api/chat';
import {
  LDAIAgentConfig,
  LDAIAgentRequestConfig,
  LDAIConfig,
  LDAIConfigKind,
  LDAIConfigTracker,
  LDAIJudgeConfig,
  LDMessage,
  LDTrackedAgent,
  LDTrackedAgents,
  LDTrackedConfig,
  LDTrackedJudge,
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
 * The result of evaluating a configuration.
 */
interface EvaluationResult {
  tracker: LDAIConfigTracker;
  config: LDAIConfigKind;
}

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
    defaultValue: LDAIConfigKind,
    variables?: Record<string, any>,
  ): Promise<EvaluationResult> {
    // Convert default value to LDFlagValue format
    const ldFlagValue = LDAIConfigUtils.toFlagValue(defaultValue);

    const value: LDAIConfigFlagValue = await this._ldClient.variation(key, context, ldFlagValue);

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

    // Convert the flag value directly to the appropriate config type
    const config = LDAIConfigUtils.fromFlagValue(value);

    // Apply variable interpolation if variables are provided
    if (variables) {
      const allVariables = { ...variables, ldctx: context };

      // Apply variable interpolation to messages if they exist
      if ('messages' in config && config.messages) {
        config.messages = config.messages.map((entry: LDMessage) => ({
          ...entry,
          content: this._interpolateTemplate(entry.content, allVariables),
        }));
      }

      // Apply variable interpolation to instructions if they exist
      if ('instructions' in config && config.instructions) {
        config.instructions = this._interpolateTemplate(config.instructions, allVariables);
      }
    }

    return {
      tracker,
      config,
    };
  }

  async config(
    key: string,
    context: LDContext,
    defaultValue: LDAIConfigKind,
    variables?: Record<string, unknown>,
  ): Promise<LDTrackedConfig> {
    this._ldClient.track('$ld:ai:config:function:single', context, key, 1);

    const { tracker, config } = await this._evaluate(key, context, defaultValue, variables);

    // Cast to LDAIConfig since config method only accepts completion configs
    const completionConfig = config as LDAIConfig;

    // Create the mapper for toVercelAISDK functionality
    const messages = 'messages' in completionConfig ? completionConfig.messages : undefined;
    const mapper = new LDAIConfigMapper(
      completionConfig.model,
      completionConfig.provider,
      messages,
    );

    return {
      tracker,
      config: {
        ...completionConfig,
        toVercelAISDK: <TMod>(
          sdkProvider: VercelAISDKProvider<TMod> | Record<string, VercelAISDKProvider<TMod>>,
          options?: VercelAISDKMapOptions | undefined,
        ): VercelAISDKConfig<TMod> => mapper.toVercelAISDK(sdkProvider, options),
      },
    };
  }

  async judge(
    key: string,
    context: LDContext,
    defaultValue: LDAIJudgeConfig,
    variables?: Record<string, unknown>,
  ): Promise<LDTrackedJudge> {
    this._ldClient.track('$ld:ai:judge:function:single', context, key, 1);

    const { tracker, config } = await this._evaluate(key, context, defaultValue, variables);

    // Cast to judge config since this method only accepts judge configs
    const judgeConfig = config as LDAIJudgeConfig;

    // Create the mapper for toVercelAISDK functionality
    const messages = 'messages' in judgeConfig ? judgeConfig.messages : undefined;
    const mapper = new LDAIConfigMapper(judgeConfig.model, judgeConfig.provider, messages);

    return {
      tracker,
      judge: {
        ...judgeConfig,
        toVercelAISDK: <TMod>(
          sdkProvider: VercelAISDKProvider<TMod> | Record<string, VercelAISDKProvider<TMod>>,
          options?: VercelAISDKMapOptions | undefined,
        ): VercelAISDKConfig<TMod> => mapper.toVercelAISDK(sdkProvider, options),
      },
    };
  }

  async agent(
    key: string,
    context: LDContext,
    defaultValue: LDAIAgentConfig,
    variables?: Record<string, unknown>,
  ): Promise<LDTrackedAgent> {
    // Track agent usage
    this._ldClient.track('$ld:ai:agent:function:single', context, key, 1);

    const { tracker, config } = await this._evaluate(key, context, defaultValue, variables);

    // Check if we have an agent config, log warning and return disabled config if not
    if (config.mode !== 'agent') {
      this._logger?.warn(
        `Configuration is not an agent (mode: ${config.mode}), returning disabled config`,
      );
      return {
        tracker,
        agent: {
          ...config,
          enabled: false,
          mode: 'agent' as const,
        } as LDAIAgentConfig,
      };
    }

    const agent = config as LDAIAgentConfig;

    return {
      tracker,
      agent,
    };
  }

  async agents<const T extends readonly LDAIAgentRequestConfig[]>(
    agentConfigs: T,
    context: LDContext,
  ): Promise<LDTrackedAgents> {
    // Track multiple agents usage
    this._ldClient.track(
      '$ld:ai:agent:function:multiple',
      context,
      agentConfigs.length,
      agentConfigs.length,
    );

    const agents = {} as Record<T[number]['key'], LDAIAgentConfig>;
    let tracker: LDAIConfigTracker | undefined;

    await Promise.all(
      agentConfigs.map(async (config) => {
        const result = await this._evaluate(
          config.key,
          context,
          config.defaultValue,
          config.variables,
        );

        // Check if we have an agent config, log warning and return disabled config if not
        if (result.config.mode !== 'agent') {
          this._logger?.warn(
            `Configuration ${config.key} is not an agent (mode: ${result.config.mode}), returning disabled config`,
          );
          agents[config.key as T[number]['key']] = {
            ...result.config,
            enabled: false,
            mode: 'agent' as const,
          } as LDAIAgentConfig;
          if (!tracker) {
            tracker = result.tracker;
          }
          return;
        }

        const agent = result.config as LDAIAgentConfig;
        agents[config.key as T[number]['key']] = agent;
        if (!tracker) {
          tracker = result.tracker;
        }
      }),
    );

    return {
      tracker: tracker!,
      agents,
    };
  }

  async initChat(
    key: string,
    context: LDContext,
    defaultValue: LDAIConfig,
    variables?: Record<string, unknown>,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<TrackedChat | undefined> {
    // Track chat initialization
    this._ldClient.track('$ld:ai:config:function:initChat', context, key, 1);

    const result = await this.config(key, context, defaultValue, variables);

    // Return undefined if the configuration is disabled
    if (!result.config.enabled) {
      this._logger?.info(`Chat configuration is disabled: ${key}`);
      return undefined;
    }

    // Check if we have a completion config, log warning and return undefined if not
    if (result.config.mode && result.config.mode !== 'completion') {
      this._logger?.warn(
        `Configuration ${key} is not a completion config (mode: ${result.config.mode}), returning undefined`,
      );
      return undefined;
    }

    // Cast to LDAIConfig since initChat only accepts completion configs
    const config = result.config as LDAIConfig;

    // Create the AIProvider instance
    const provider = await AIProviderFactory.create(config, this._logger, defaultAiProvider);
    if (!provider) {
      return undefined;
    }

    // Create the TrackedChat instance with the provider
    return new TrackedChat(config, result.tracker, provider);
  }

  async initJudge(
    key: string,
    context: LDContext,
    defaultValue: LDAIJudgeConfig,
    variables?: Record<string, unknown>,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<Judge | undefined> {
    // Track judge initialization
    this._ldClient.track('$ld:ai:judge:function:initJudge', context, key, 1);

    try {
      // Retrieve the judge AI Config using the new judge method
      const result = await this.judge(key, context, defaultValue, variables);

      // Return undefined if the configuration is disabled
      if (!result.judge.enabled) {
        this._logger?.info(`Judge configuration is disabled: ${key}`);
        return undefined;
      }

      // Validate that this is a judge configuration
      if (result.judge.mode !== 'judge') {
        this._logger?.warn(`Configuration ${key} is not a judge (mode: ${result.judge.mode})`);
        return undefined;
      }

      // Validate that the judge configuration has the required evaluation metric keys
      if (!result.judge.evaluationMetricKeys || result.judge.evaluationMetricKeys.length === 0) {
        this._logger?.error(`Judge configuration ${key} is missing required evaluationMetricKeys`);
        return undefined;
      }

      // Create the AIProvider instance
      const provider = await AIProviderFactory.create(
        result.judge,
        this._logger,
        defaultAiProvider,
      );
      if (!provider) {
        return undefined;
      }

      // Create and return the Judge instance
      return new Judge(result.judge, result.tracker, provider, this._logger);
    } catch (error) {
      this._logger?.error(`Failed to initialize judge ${key}:`, error);
      return undefined;
    }
  }
}
