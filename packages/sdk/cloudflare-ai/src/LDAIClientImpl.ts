import mustache from 'mustache';

import { LDContext } from '@launchdarkly/cloudflare-server-sdk';

import type {
  CloudflareAIConfig,
  CloudflareAIMapOptions,
  LDAIConfig,
  LDAIDefaults,
  LDMessage,
  LDModelConfig,
  LDProviderConfig,
} from './api/config/LDAIConfig';
import type { LDAIConfigTracker } from './api/config/LDAIConfigTracker';
import type { LDAIClient } from './api/LDAIClient';
import { getClientKVMeta } from './ClientKVMeta';
import { CloudflareAIModelMapper } from './CloudflareAIModelMapper';
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

    const config: Omit<LDAIConfig, 'toCloudflareWorkersAI' | 'runWithWorkersAI'> = {
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
      toCloudflareWorkersAI: (options?: CloudflareAIMapOptions): CloudflareAIConfig =>
        CloudflareAIModelMapper.toCloudflareWorkersAI(
          { model: config.model, messages: config.messages },
          options,
        ),
      async runWithWorkersAI<T = unknown>(
        aiBinding: any,
        options?: CloudflareAIMapOptions,
      ): Promise<T> {
        const cfConfig = CloudflareAIModelMapper.toCloudflareWorkersAI(
          { model: config.model, messages: config.messages },
          options,
        );

        const start = Date.now();
        try {
          const result: any = await aiBinding.run(cfConfig.model, cfConfig);
          const duration = Date.now() - start;

          config.tracker.trackMetrics({
            durationMs: duration,
            success: true,
            usage: {
              inputTokens: result?.usage?.input_tokens || 0,
              outputTokens: result?.usage?.output_tokens || 0,
              totalTokens: result?.usage?.total_tokens || 0,
            },
          });

          return result as T;
        } catch (err) {
          const duration = Date.now() - start;
          try {
            config.tracker.trackMetrics({ durationMs: duration, success: false });
            (config.tracker as any).trackError?.();
          } catch (_) {
            // ignore
          }
          throw err;
        }
      },
    };
  }
}
