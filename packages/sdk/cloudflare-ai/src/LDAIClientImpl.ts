import mustache from 'mustache';

import { LDContext } from '@launchdarkly/cloudflare-server-sdk';

import type { LDAIAgent, LDAIAgentConfig, LDAIAgentDefaults } from './api/agents/LDAIAgent';
import type {
  LDAIConfig,
  LDAIDefaults,
  LDMessage,
  LDModelConfig,
  LDProviderConfig,
  WorkersAIConfig,
  WorkersAIMapOptions,
} from './api/config/LDAIConfig';
import type { LDAIConfigTracker } from './api/config/LDAIConfigTracker';
import type { LDAIClient } from './api/LDAIClient';
import { getClientKVMeta } from './ClientKVMeta';
import { LDAIConfigTrackerImpl } from './LDAIConfigTrackerImpl';
import type { LDClientMin } from './LDClientMin';

/**
 * Metadata from LaunchDarkly variation.
 */
interface LDMeta {
  variationKey: string;
  enabled: boolean;
  version?: number;
}

/**
 * Internal variation content from LaunchDarkly.
 */
interface VariationContent {
  model?: LDModelConfig;
  messages?: LDMessage[];
  provider?: LDProviderConfig;
  // eslint-disable-next-line no-underscore-dangle
  _ldMeta?: LDMeta;
}

/**
 * Result of evaluating a configuration.
 */
interface EvaluationResult {
  tracker: LDAIConfigTracker;
  enabled: boolean;
  model?: LDModelConfig;
  provider?: LDProviderConfig;
  messages?: LDMessage[];
}

/**
 * Implementation of the AI client for Cloudflare Workers.
 */
export class LDAIClientImpl implements LDAIClient {
  constructor(private readonly _ldClient: LDClientMin) {}

  private _interpolateTemplate(template: string, variables: Record<string, unknown>): string {
    return mustache.render(template, variables, undefined, { escape: (item: any) => item });
  }

  private _mapWorkersAIParameters(params: Record<string, unknown>): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      const k = key.toLowerCase();
      if (k === 'maxtokens' || k === 'max_tokens') mapped.max_tokens = value;
      else if (k === 'topp' || k === 'top_p') mapped.top_p = value;
      else if (k === 'topk' || k === 'top_k') mapped.top_k = value;
      else if (k === 'frequencypenalty' || k === 'frequency_penalty')
        mapped.frequency_penalty = value;
      else if (k === 'presencepenalty' || k === 'presence_penalty') mapped.presence_penalty = value;
      else if (k === 'temperature') mapped.temperature = value;
      else mapped[key] = value;
    }
    return mapped;
  }

  private _toWorkersAI(
    model: LDModelConfig | undefined,
    messages: LDMessage[] | undefined,
    options?: WorkersAIMapOptions,
  ): WorkersAIConfig {
    const out: WorkersAIConfig = { model: options?.modelOverride || model?.name || '' };
    if (messages && messages.length > 0) {
      out.messages = messages.map((m) => ({ role: m.role, content: m.content }));
    }
    if (model?.parameters) Object.assign(out, this._mapWorkersAIParameters(model.parameters));
    if (options?.stream !== undefined) out.stream = options.stream;
    if (options?.additionalParams) Object.assign(out, options.additionalParams);
    return out;
  }

  /**
   * Reads AI Config directly from KV, bypassing standard flag evaluation.
   * AI Configs are pre-evaluated by LaunchDarkly's backend and stored under
   * the environment payload in Cloudflare KV. When available, prefer this
   * path so the selected variation (including model/provider/messages and
   * _ldMeta) is used exactly as defined in LaunchDarkly.
   */
  private async _readAIConfigFromKV(key: string): Promise<VariationContent | null> {
    const kvMeta = getClientKVMeta(this._ldClient);
    if (!kvMeta) {
      return null;
    }

    try {
      const kvKey = `LD-Env-${kvMeta.clientSideID}`;
      const data = await kvMeta.kvNamespace.get(kvKey, 'json');
      if (!data || typeof data !== 'object') {
        return null;
      }

      const { flags } = data as any;
      if (!flags || typeof flags !== 'object') {
        return null;
      }

      const aiConfig = flags[key];
      if (!aiConfig) {
        return null;
      }

      // AI Configs are pre-evaluated and placed under `value` by the backend.
      if (aiConfig.value && typeof aiConfig.value === 'object') {
        return aiConfig.value as VariationContent;
      }

      return null;
    } catch (_err) {
      return null;
    }
  }

  private async _evaluate(
    key: string,
    context: LDContext,
    defaultValue: LDAIDefaults,
  ): Promise<EvaluationResult> {
    // Read the pre-evaluated AI Config from KV.
    const kvValue = await this._readAIConfigFromKV(key);

    let value: VariationContent;
    if (kvValue) {
      value = kvValue;
    } else {
      // Fallback to Cloudflare server SDK evaluation (reads from KV for flags)
      const detail: any = await this._ldClient.variationDetail(key, context, defaultValue);
      if (detail && detail.value && typeof detail.value === 'object' && 'value' in detail.value) {
        value = detail.value.value;
      } else if (detail && detail.value) {
        value = detail.value;
      } else {
        // Last resort: use default from code
        value = defaultValue as VariationContent;
      }
    }

    const tracker = new LDAIConfigTrackerImpl(
      this._ldClient,
      key,
      // eslint-disable-next-line no-underscore-dangle
      value._ldMeta?.variationKey ?? '',
      // eslint-disable-next-line no-underscore-dangle
      value._ldMeta?.version ?? 1,
      value.model?.name ?? '',
      value.provider?.name ?? 'cloudflare-workers-ai',
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
    };
  }

  async config(
    key: string,
    context: LDContext,
    defaultValue: LDAIDefaults,
    variables?: Record<string, unknown>,
  ): Promise<LDAIConfig> {
    this._ldClient.track('$ld:ai:config:function:single', context, key, 1);

    const { tracker, enabled, model, provider, messages } = await this._evaluate(
      key,
      context,
      defaultValue,
    );

    const config: Omit<LDAIConfig, 'toWorkersAI'> = {
      tracker,
      enabled,
    };

    if (model) {
      config.model = { ...model };
    }

    if (provider) {
      config.provider = { ...provider };
    }

    const allVariables = { ...variables, ldctx: context };

    if (messages) {
      config.messages = messages.map((entry: LDMessage) => ({
        ...entry,
        content: this._interpolateTemplate(entry.content, allVariables),
      }));
    }

    return {
      ...config,
      toWorkersAI: (_binding, options?: WorkersAIMapOptions): WorkersAIConfig =>
        this._toWorkersAI(config.model, config.messages, options),
    };
  }

  async agent(
    key: string,
    context: LDContext,
    defaultValue: LDAIAgentDefaults,
    variables?: Record<string, unknown>,
  ): Promise<LDAIAgent> {
    this._ldClient.track('$ld:ai:agent:function:single', context, key, 1);

    const { tracker, enabled, model, provider, messages } = await this._evaluate(
      key,
      context,
      defaultValue as any,
    );

    const allVariables = { ...variables, ldctx: context };
    const instructionsRaw = (defaultValue?.instructions ?? '') as string;
    const instructions = instructionsRaw
      ? this._interpolateTemplate(instructionsRaw, allVariables)
      : undefined;

    const agent: Omit<LDAIAgent, 'toWorkersAI'> = {
      tracker,
      enabled,
      model,
      provider,
      instructions,
    };

    return {
      ...agent,
      toWorkersAI: (_binding, options?: WorkersAIMapOptions): WorkersAIConfig =>
        this._toWorkersAI(agent.model, messages, options),
    } as LDAIAgent;
  }

  async agents<TConfigs extends readonly LDAIAgentConfig[]>(
    agentConfigs: TConfigs,
    context: LDContext,
  ): Promise<Record<TConfigs[number]['key'], LDAIAgent>> {
    const results = await Promise.all(
      agentConfigs.map((cfg) => this.agent(cfg.key, context, cfg.defaultValue, cfg.variables)),
    );
    const map = {} as Record<string, LDAIAgent>;
    agentConfigs.forEach((cfg, idx) => {
      map[cfg.key] = results[idx];
    });
    return map as Record<TConfigs[number]['key'], LDAIAgent>;
  }
}
