import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDAIConfigTracker } from './api/config';
import { LDAIMetricSummary } from './api/config/LDAIConfigTracker';
import {
  createBedrockTokenUsage,
  createOpenAiUsage,
  createVercelAISDKTokenUsage,
  LDFeedbackKind,
  LDTokenUsage,
} from './api/metrics';
import { LDClientMin } from './LDClientMin';

export class LDAIConfigTrackerImpl implements LDAIConfigTracker {
  private _trackedMetrics: LDAIMetricSummary = {};

  constructor(
    private _ldClient: LDClientMin,
    private _configKey: string,
    private _variationKey: string,
    private _version: number,
    private _context: LDContext,
  ) {}

  private _getTrackData(): { variationKey: string; configKey: string; version: number } {
    return {
      variationKey: this._variationKey,
      configKey: this._configKey,
      version: this._version,
    };
  }

  trackDuration(duration: number): void {
    this._trackedMetrics.durationMs = duration;
    this._ldClient.track('$ld:ai:duration:total', this._context, this._getTrackData(), duration);
  }

  async trackDurationOf<TRes>(func: () => Promise<TRes>): Promise<TRes> {
    const startTime = Date.now();
    try {
      // Be sure to await here so that we can track the duration of the function and also handle errors.
      const result = await func();
      return result;
    } finally {
      const endTime = Date.now();
      const duration = endTime - startTime; // duration in milliseconds
      this.trackDuration(duration);
    }
  }

  trackTimeToFirstToken(timeToFirstTokenMs: number) {
    this._trackedMetrics.timeToFirstTokenMs = timeToFirstTokenMs;
    this._ldClient.track(
      '$ld:ai:tokens:ttf',
      this._context,
      this._getTrackData(),
      timeToFirstTokenMs,
    );
  }

  trackFeedback(feedback: { kind: LDFeedbackKind }): void {
    this._trackedMetrics.feedback = feedback;
    if (feedback.kind === LDFeedbackKind.Positive) {
      this._ldClient.track('$ld:ai:feedback:user:positive', this._context, this._getTrackData(), 1);
    } else if (feedback.kind === LDFeedbackKind.Negative) {
      this._ldClient.track('$ld:ai:feedback:user:negative', this._context, this._getTrackData(), 1);
    }
  }

  trackSuccess(): void {
    this._trackedMetrics.success = true;
    this._ldClient.track('$ld:ai:generation:success', this._context, this._getTrackData(), 1);
  }

  trackError(): void {
    this._trackedMetrics.success = false;
    this._ldClient.track('$ld:ai:generation:error', this._context, this._getTrackData(), 1);
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
    try {
      const result = await this.trackDurationOf(func);
      this.trackSuccess();
      if (result.usage) {
        this.trackTokens(createOpenAiUsage(result.usage));
      }
      return result;
    } catch (err) {
      this.trackError();
      throw err;
    }
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
      this.trackError();
    }
    if (res.metrics && res.metrics.latencyMs) {
      this.trackDuration(res.metrics.latencyMs);
    }
    if (res.usage) {
      this.trackTokens(createBedrockTokenUsage(res.usage));
    }
    return res;
  }

  async trackVercelAISDKGenerateTextMetrics<
    TRes extends {
      usage?: {
        totalTokens?: number;
        promptTokens?: number;
        completionTokens?: number;
      };
    },
  >(func: () => Promise<TRes>): Promise<TRes> {
    try {
      const result = await this.trackDurationOf(func);
      this.trackSuccess();
      if (result.usage) {
        this.trackTokens(createVercelAISDKTokenUsage(result.usage));
      }
      return result;
    } catch (err) {
      this.trackError();
      throw err;
    }
  }

  trackVercelAISDKStreamTextMetrics<
    TRes extends {
      finishReason?: Promise<string>;
      usage?: Promise<{
        totalTokens?: number;
        promptTokens?: number;
        completionTokens?: number;
      }>;
    },
  >(func: () => TRes): TRes {
    const startTime = Date.now();
    try {
      const result = func();
      result.finishReason
        ?.then(async (finishReason) => {
          const endTime = Date.now();
          this.trackDuration(endTime - startTime);
          if (finishReason === 'error') {
            this.trackError();
          } else {
            this.trackSuccess();
            if (result.usage) {
              try {
                this.trackTokens(createVercelAISDKTokenUsage(await result.usage));
              } catch {
                // Intentionally squashing this error
              }
            }
          }
        })
        .catch(() => {
          const endTime = Date.now();
          this.trackDuration(endTime - startTime);
          this.trackError();
        });
      return result;
    } catch (err) {
      const endTime = Date.now();
      this.trackDuration(endTime - startTime);
      this.trackError();
      throw err;
    }
  }

  trackTokens(tokens: LDTokenUsage): void {
    this._trackedMetrics.tokens = tokens;
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

  /**
   * Get a summary of the tracked metrics.
   */
  getSummary(): LDAIMetricSummary {
    return { ...this._trackedMetrics };
  }
}
