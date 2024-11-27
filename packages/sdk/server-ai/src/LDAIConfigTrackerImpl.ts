import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDAIConfigTracker } from './api/config';
import { createBedrockTokenUsage, LDFeedbackKind, LDTokenUsage } from './api/metrics';
import { createOpenAiUsage } from './api/metrics/OpenAiUsage';
import { LDClientMin } from './LDClientMin';

export class LDAIConfigTrackerImpl implements LDAIConfigTracker {
  constructor(
    private _ldClient: LDClientMin,
    private _configKey: string,
    private _versionKey: string,
    private _context: LDContext,
  ) {}

  private _getTrackData(): { versionKey: string; configKey: string } {
    return {
      versionKey: this._versionKey,
      configKey: this._configKey,
    };
  }

  trackDuration(duration: number): void {
    this._ldClient.track('$ld:ai:duration:total', this._context, this._getTrackData(), duration);
  }

  async trackDurationOf<TRes>(func: () => Promise<TRes>): Promise<TRes> {
    const startTime = Date.now();
    const result = await func();
    const endTime = Date.now();
    const duration = endTime - startTime; // duration in milliseconds
    this.trackDuration(duration);
    return result;
  }

  trackFeedback(feedback: { kind: LDFeedbackKind }): void {
    if (feedback.kind === LDFeedbackKind.Positive) {
      this._ldClient.track('$ld:ai:feedback:user:positive', this._context, this._getTrackData(), 1);
    } else if (feedback.kind === LDFeedbackKind.Negative) {
      this._ldClient.track('$ld:ai:feedback:user:negative', this._context, this._getTrackData(), 1);
    }
  }

  trackSuccess(): void {
    this._ldClient.track('$ld:ai:generation', this._context, this._getTrackData(), 1);
  }

  async trackOpenAIMetrics<
    TRes extends {
      usage?: {
        total_tokens?: number;
        prompt_tokens?: number;
        completion_tokens?: number;
      };
    },
  >(func: () => Promise<TRes>): Promise<TRes> {
    const result = await this.trackDurationOf(func);
    this.trackSuccess();
    if (result.usage) {
      this.trackTokens(createOpenAiUsage(result.usage));
    }
    return result;
  }

  trackBedrockConverseMetrics<
    TRes extends {
      $metadata: { httpStatusCode?: number };
      metrics?: { latencyMs?: number };
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
      };
    },
  >(res: TRes): TRes {
    if (res.$metadata?.httpStatusCode === 200) {
      this.trackSuccess();
    } else if (res.$metadata?.httpStatusCode && res.$metadata.httpStatusCode >= 400) {
      // Potentially add error tracking in the future.
    }
    if (res.metrics && res.metrics.latencyMs) {
      this.trackDuration(res.metrics.latencyMs);
    }
    if (res.usage) {
      this.trackTokens(createBedrockTokenUsage(res.usage));
    }
    return res;
  }

  trackTokens(tokens: LDTokenUsage): void {
    const trackData = this._getTrackData();
    if (tokens.total > 0) {
      this._ldClient.track('$ld:ai:tokens:total', this._context, trackData, tokens.total);
    }
    if (tokens.input > 0) {
      this._ldClient.track('$ld:ai:tokens:input', this._context, trackData, tokens.input);
    }
    if (tokens.output > 0) {
      this._ldClient.track('$ld:ai:tokens:output', this._context, trackData, tokens.output);
    }
  }
}
