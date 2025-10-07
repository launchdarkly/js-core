import { LDContext } from '@launchdarkly/cloudflare-server-sdk';

import type { LDAIConfigTracker, LDAIMetricSummary } from './api/config/LDAIConfigTracker';
import type { LDFeedbackKind, LDTokenUsage } from './api/metrics';
import type { LDClientMin } from './LDClientMin';

/**
 * Implementation of AI configuration tracker for metrics and analytics.
 */
export class LDAIConfigTrackerImpl implements LDAIConfigTracker {
  private _tracked: LDAIMetricSummary = {};
  constructor(
    private readonly _ldClient: LDClientMin,
    private readonly _configKey: string,
    private readonly _variationKey: string,
    private readonly _version: number,
    private readonly _modelName: string,
    private readonly _providerName: string,
    private readonly _context: LDContext,
  ) {}

  trackSuccess(): void {
    this._ldClient.track('$ld:ai:generation', this._context, this._createBaseMetadata(), 1);
    this._tracked.success = true;
  }

  trackError(): void {
    this._ldClient.track(
      '$ld:ai:generation',
      this._context,
      { ...this._createBaseMetadata(), success: false },
      0,
    );
    this._tracked.success = false;
  }

  trackDuration(durationMs: number): void {
    this._ldClient.track(
      '$ld:ai:duration',
      this._context,
      {
        ...this._createBaseMetadata(),
        durationMs,
      },
      durationMs,
    );
    this._tracked.durationMs = durationMs;
  }

  trackMetrics(metrics: { durationMs: number; usage?: LDTokenUsage; success: boolean }): void {
    const metadata = {
      ...this._createBaseMetadata(),
      durationMs: metrics.durationMs,
      success: metrics.success,
    };

    if (metrics.usage) {
      Object.assign(metadata, {
        inputTokens: metrics.usage.input,
        outputTokens: metrics.usage.output,
        totalTokens: metrics.usage.total,
      });
      this._tracked.tokens = metrics.usage;
    }

    this._tracked.durationMs = metrics.durationMs;
    this._tracked.success = metrics.success;

    this._ldClient.track('$ld:ai:generation', this._context, metadata, 1);

    if (metrics.usage) {
      this._ldClient.track('$ld:ai:tokens', this._context, metadata, metrics.usage.total);
    }
  }

  trackTokens(usage: LDTokenUsage): void {
    const metadata = {
      ...this._createBaseMetadata(),
      inputTokens: usage.input,
      outputTokens: usage.output,
      totalTokens: usage.total,
    };
    this._ldClient.track('$ld:ai:tokens', this._context, metadata, usage.total);
    this._tracked.tokens = usage;
  }

  trackFeedback(kind: LDFeedbackKind): void {
    this._ldClient.track(
      '$ld:ai:feedback',
      this._context,
      {
        ...this._createBaseMetadata(),
        feedback: kind,
      },
      kind === 'positive' ? 1 : 0,
    );
    this._tracked.feedback = { kind } as any;
  }

  trackTimeToFirstToken(timeToFirstTokenMs: number): void {
    this._ldClient.track(
      '$ld:ai:ttft',
      this._context,
      { ...this._createBaseMetadata(), timeToFirstTokenMs },
      timeToFirstTokenMs,
    );
    this._tracked.timeToFirstTokenMs = timeToFirstTokenMs;
  }

  async trackDurationOf<T>(func: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const res = await func();
      this.trackDuration(Date.now() - start);
      return res;
    } catch (e) {
      this.trackDuration(Date.now() - start);
      throw e;
    }
  }

  async trackWorkersAIMetrics<
    T extends {
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        input_tokens?: number;
        output_tokens?: number;
      };
    },
  >(func: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const res = await func();
      const duration = Date.now() - start;
      this.trackDuration(duration);
      this.trackSuccess();
      const usage = res?.usage;
      if (usage) {
        const input = (usage as any).prompt_tokens ?? (usage as any).input_tokens ?? 0;
        const output = (usage as any).completion_tokens ?? (usage as any).output_tokens ?? 0;
        const total = (usage as any).total_tokens ?? input + output;
        this.trackTokens({ input, output, total });
      }
      return res;
    } catch (e) {
      const duration = Date.now() - start;
      this.trackDuration(duration);
      this.trackError();
      throw e;
    }
  }

  trackWorkersAIStreamMetrics<
    T extends {
      usage?: Promise<{
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        input_tokens?: number;
        output_tokens?: number;
      }>;
      finishReason?: Promise<string>;
    },
  >(func: () => T): T {
    const start = Date.now();
    const stream = func();
    // Best effort: attach handlers if promises exist
    (async () => {
      try {
        await stream.finishReason?.catch?.(() => undefined);
        const duration = Date.now() - start;
        this.trackDuration(duration);
        this.trackSuccess();
        const usage = await (stream.usage ?? Promise.resolve(undefined));
        if (usage) {
          const input = (usage as any).prompt_tokens ?? (usage as any).input_tokens ?? 0;
          const output = (usage as any).completion_tokens ?? (usage as any).output_tokens ?? 0;
          const total = (usage as any).total_tokens ?? input + output;
          this.trackTokens({ input, output, total });
        }
      } catch (e) {
        const duration = Date.now() - start;
        this.trackDuration(duration);
        this.trackError();
      }
    })();
    return stream;
  }

  getSummary(): LDAIMetricSummary {
    return { ...this._tracked };
  }

  private _createBaseMetadata(): Record<string, unknown> {
    return {
      aiConfigKey: this._configKey,
      variationKey: this._variationKey,
      version: this._version,
      model: this._modelName,
      provider: this._providerName,
    };
  }
}
