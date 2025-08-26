import * as Mustache from 'mustache';

import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDAIAgent, LDAIAgentConfig, LDAIAgentDefaults } from './api/agents';
import {
  LDAIConfig,
  LDAIConfigTracker,
  LDAIDefaults,
  LDMessage,
  LDModelConfig,
  LDProviderConfig,
  VercelAISDKConfig,
  VercelAISDKMapOptions,
  VercelAISDKProvider,
} from './api/config';
import { LDAIClient } from './api/LDAIClient';
import { LDAIConfigMapper } from './LDAIConfigMapper';
import { LDAIConfigTrackerImpl } from './LDAIConfigTrackerImpl';
import { LDClientMin } from './LDClientMin';

type Mode = 'completion' | 'agent';

/**
 * Metadata associated with a model configuration variation.
 */
interface LDMeta {
  variationKey: string;
  enabled: boolean;
  version?: number;
  mode?: Mode;
}

/**
 * Interface for the model configuration variation returned by LaunchDarkly. This is the internal
 * typing and not meant for exposure to the application developer.
 */
interface VariationContent {
  model?: LDModelConfig;
  messages?: LDMessage[];
  instructions?: string;
  provider?: LDProviderConfig;
  _ldMeta?: LDMeta;
}

/**
 * The result of evaluating a configuration.
 */
interface EvaluationResult {
  tracker: LDAIConfigTracker;
  enabled: boolean;
  model?: LDModelConfig;
  provider?: LDProviderConfig;
  messages?: LDMessage[];
  instructions?: string;
  mode?: string;
}

export class LDAIClientImpl implements LDAIClient {
  constructor(private _ldClient: LDClientMin) {}

  private _interpolateTemplate(template: string, variables: Record<string, unknown>): string {
    return Mustache.render(template, variables, undefined, { escape: (item: any) => item });
  }

  private async _evaluate(
    key: string,
    context: LDContext,
    defaultValue: LDAIDefaults,
  ): Promise<EvaluationResult> {
    const value: VariationContent = await this._ldClient.variation(key, context, defaultValue);

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

    // eslint-disable-next-line no-underscore-dangle
    const enabled = !!value._ldMeta?.enabled;

    return {
      tracker,
      enabled,
      model: value.model,
      provider: value.provider,
      messages: value.messages,
      instructions: value.instructions,
      // eslint-disable-next-line no-underscore-dangle
      mode: value._ldMeta?.mode ?? 'completion',
    };
  }

  private async _evaluateAgent(
    key: string,
    context: LDContext,
    defaultValue: LDAIAgentDefaults,
    variables?: Record<string, unknown>,
  ): Promise<LDAIAgent> {
    const { tracker, enabled, model, provider, instructions } = await this._evaluate(
      key,
      context,
      defaultValue,
    );

    const agent: LDAIAgent = {
      tracker,
      enabled,
    };

    // We are going to modify the contents before returning them, so we make a copy.
    // This isn't a deep copy and the application developer should not modify the returned content.
    if (model) {
      agent.model = { ...model };
    }

    if (provider) {
      agent.provider = { ...provider };
    }

    const allVariables = { ...variables, ldctx: context };

    if (instructions) {
      agent.instructions = this._interpolateTemplate(instructions, allVariables);
    }

    return agent;
  }

  async config(
    key: string,
    context: LDContext,
    defaultValue: LDAIDefaults,
    variables?: Record<string, unknown>,
  ): Promise<LDAIConfig> {
    this._ldClient.track('$ld:ai:config:function:single', context, key, 1);

    const {
      tracker,
      enabled,
      model,
      provider: configProvider,
      messages,
    } = await this._evaluate(key, context, defaultValue);

    const config: Omit<LDAIConfig, 'toVercelAISDK'> = {
      tracker,
      enabled,
    };

    // We are going to modify the contents before returning them, so we make a copy.
    // This isn't a deep copy and the application developer should not modify the returned content.
    if (model) {
      config.model = { ...model };
    }
    if (configProvider) {
      config.provider = { ...configProvider };
    }
    const allVariables = { ...variables, ldctx: context };

    if (messages) {
      config.messages = messages.map((entry: any) => ({
        ...entry,
        content: this._interpolateTemplate(entry.content, allVariables),
      }));
    }

    const mapper = new LDAIConfigMapper(config.model, config.provider, config.messages);

    return {
      ...config,
      toVercelAISDK: <TMod>(
        sdkProvider: VercelAISDKProvider<TMod> | Record<string, VercelAISDKProvider<TMod>>,
        options?: VercelAISDKMapOptions | undefined,
      ): VercelAISDKConfig<TMod> => mapper.toVercelAISDK(sdkProvider, options),
    };
  }

  async agent(
    key: string,
    context: LDContext,
    defaultValue: LDAIAgentDefaults,
    variables?: Record<string, unknown>,
  ): Promise<LDAIAgent> {
    // Track agent usage
    this._ldClient.track('$ld:ai:agent:function:single', context, key, 1);

    return this._evaluateAgent(key, context, defaultValue, variables);
  }

  async agents<const T extends readonly (LDAIAgentConfig & { defaultValue: LDAIAgentDefaults })[]>(
    agentConfigs: T,
    context: LDContext,
  ): Promise<Record<T[number]['key'], LDAIAgent>> {
    // Track multiple agents usage
    this._ldClient.track(
      '$ld:ai:agent:function:multiple',
      context,
      agentConfigs.length,
      agentConfigs.length,
    );

    const agents = {} as Record<T[number]['key'], LDAIAgent>;

    await Promise.all(
      agentConfigs.map(async (config) => {
        const agent = await this._evaluateAgent(
          config.key,
          context,
          config.defaultValue,
          config.variables,
        );
        agents[config.key as T[number]['key']] = agent;
      }),
    );

    return agents;
  }
}
