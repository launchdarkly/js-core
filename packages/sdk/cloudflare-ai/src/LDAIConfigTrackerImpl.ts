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
    this._ldClient.track('$ld:ai:generation:success', this._context, this._createBaseMetadata(), 1);
    this._tracked.success = true;
  }

  trackError(): void {
    this._ldClient.track('$ld:ai:generation:error', this._context, this._createBaseMetadata(), 1);
    this._tracked.success = false;
  }

  trackDuration(durationMs: number): void {
    this._ldClient.track(
      '$ld:ai:duration:total',
      this._context,
      this._createBaseMetadata(),
      durationMs,
    );
    this._tracked.durationMs = durationMs;
  }

  trackMetrics(metrics: { durationMs: number; usage?: LDTokenUsage; success: boolean }): void {
    this._tracked.durationMs = metrics.durationMs;
    this.trackDuration(metrics.durationMs);
    if (metrics.success) {
      this.trackSuccess();
    } else {
      this.trackError();
    }
    if (metrics.usage) {
      this.trackTokens(metrics.usage);
    }
  }

  trackTokens(usage: LDTokenUsage): void {
    const metadata = this._createBaseMetadata();
    if (usage.total > 0) {
      this._ldClient.track('$ld:ai:tokens:total', this._context, metadata, usage.total);
    }
    if (usage.input > 0) {
      this._ldClient.track('$ld:ai:tokens:input', this._context, metadata, usage.input);
    }
    if (usage.output > 0) {
      this._ldClient.track('$ld:ai:tokens:output', this._context, metadata, usage.output);
    }
    this._tracked.tokens = usage;
  }

  trackFeedback(kind: LDFeedbackKind): void {
    if (kind === 'positive') {
      this._ldClient.track(
        '$ld:ai:feedback:user:positive',
        this._context,
        this._createBaseMetadata(),
        1,
      );
    } else if (kind === 'negative') {
      this._ldClient.track(
        '$ld:ai:feedback:user:negative',
        this._context,
        this._createBaseMetadata(),
        1,
      );
    }
    this._tracked.feedback = { kind } as any;
  }

  trackTimeToFirstToken(timeToFirstTokenMs: number): void {
    this._ldClient.track(
      '$ld:ai:tokens:ttf',
      this._context,
      this._createBaseMetadata(),
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
