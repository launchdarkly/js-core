import { LDContext } from '@launchdarkly/cloudflare-server-sdk';

import type { LDAIConfigTracker } from './api/config/LDAIConfigTracker';
import type { LDFeedbackKind, LDTokenUsage } from './api/metrics';
import type { LDClientMin } from './LDClientMin';

/**
 * Implementation of AI configuration tracker for metrics and analytics.
 */
export class LDAIConfigTrackerImpl implements LDAIConfigTracker {
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
  }

  trackError(): void {
    this._ldClient.track(
      '$ld:ai:generation',
      this._context,
      { ...this._createBaseMetadata(), success: false },
      0,
    );
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
  }

  trackMetrics(metrics: { durationMs: number; usage?: LDTokenUsage; success: boolean }): void {
    const metadata = {
      ...this._createBaseMetadata(),
      durationMs: metrics.durationMs,
      success: metrics.success,
    };

    if (metrics.usage) {
      Object.assign(metadata, {
        inputTokens: metrics.usage.inputTokens,
        outputTokens: metrics.usage.outputTokens,
        totalTokens: metrics.usage.totalTokens,
      });
    }

    this._ldClient.track('$ld:ai:generation', this._context, metadata, 1);

    if (metrics.usage) {
      this._ldClient.track('$ld:ai:tokens', this._context, metadata, metrics.usage.totalTokens);
    }

    this.trackDuration(metrics.durationMs);
  }

  trackTokens(usage: LDTokenUsage): void {
    const metadata = {
      ...this._createBaseMetadata(),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
    };
    this._ldClient.track('$ld:ai:tokens', this._context, metadata, usage.totalTokens);
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
  }

  trackTimeToFirstToken(timeToFirstTokenMs: number): void {
    this._ldClient.track(
      '$ld:ai:ttft',
      this._context,
      { ...this._createBaseMetadata(), timeToFirstTokenMs },
      timeToFirstTokenMs,
    );
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
