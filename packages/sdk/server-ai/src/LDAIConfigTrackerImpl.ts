import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDAIConfigTracker } from './api/config';
import { LDAIMetricSummary } from './api/config/LDAIConfigTracker';
import { EvalScore, JudgeResponse } from './api/judge/types';
import {
  createBedrockTokenUsage,
  createOpenAiUsage,
  createVercelAISDKTokenUsage,
  LDAIMetrics,
  LDFeedbackKind,
  LDTokenUsage,
} from './api/metrics';
import { LDClientMin } from './LDClientMin';
import { aiSdkName, aiSdkVersion } from './sdkInfo';

export class LDAIConfigTrackerImpl implements LDAIConfigTracker {
  private _trackedMetrics: LDAIMetricSummary = {};

  constructor(
    private _ldClient: LDClientMin,
    private _configKey: string,
    private _variationKey: string,
    private _version: number,
    private _modelName: string,
    private _providerName: string,
    private _context: LDContext,
  ) {}

  getTrackData(): {
    variationKey: string;
    configKey: string;
    version: number;
    modelName: string;
    providerName: string;
    aiSdkName: string;
    aiSdkVersion: string;
  } {
    return {
      variationKey: this._variationKey,
      configKey: this._configKey,
      version: this._version,
      modelName: this._modelName,
      providerName: this._providerName,
      aiSdkName,
      aiSdkVersion,
    };
  }

  trackDuration(duration: number): void {
    this._trackedMetrics.durationMs = duration;
    this._ldClient.track('$ld:ai:duration:total', this._context, this.getTrackData(), duration);
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
      this.getTrackData(),
      timeToFirstTokenMs,
    );
  }

  trackEvalScores(scores: Record<string, EvalScore>) {
    Object.entries(scores).forEach(([metricKey, evalScore]) => {
      this._ldClient.track(metricKey, this._context, this.getTrackData(), evalScore.score);
    });
  }

  trackJudgeResponse(response: JudgeResponse) {
    Object.entries(response.evals).forEach(([metricKey, evalScore]) => {
      this._ldClient.track(
        metricKey,
        this._context,
        { ...this.getTrackData(), judgeConfigKey: response.judgeConfigKey },
        evalScore.score,
      );
    });
  }

  trackFeedback(feedback: { kind: LDFeedbackKind }): void {
    this._trackedMetrics.feedback = feedback;
    if (feedback.kind === LDFeedbackKind.Positive) {
      this._ldClient.track('$ld:ai:feedback:user:positive', this._context, this.getTrackData(), 1);
    } else if (feedback.kind === LDFeedbackKind.Negative) {
      this._ldClient.track('$ld:ai:feedback:user:negative', this._context, this.getTrackData(), 1);
    }
  }

  trackSuccess(): void {
    this._trackedMetrics.success = true;
    this._ldClient.track('$ld:ai:generation:success', this._context, this.getTrackData(), 1);
  }

  trackError(): void {
    this._trackedMetrics.success = false;
    this._ldClient.track('$ld:ai:generation:error', this._context, this.getTrackData(), 1);
  }

  async trackMetricsOf<TRes>(
    metricsExtractor: (result: TRes) => LDAIMetrics,
    func: () => Promise<TRes>,
  ): Promise<TRes> {
    let result: TRes;

    try {
      result = await this.trackDurationOf(func);
    } catch (err) {
      this.trackError();
      throw err;
    }

    // Extract metrics after successful AI call
    const metrics = metricsExtractor(result);

    // Track success/error based on metrics
    if (metrics.success) {
      this.trackSuccess();
    } else {
      this.trackError();
    }

    // Track token usage if available
    if (metrics.usage) {
      this.trackTokens(metrics.usage);
    }

    return result;
  }

  trackStreamMetricsOf<TStream>(
    streamCreator: () => TStream,
    metricsExtractor: (stream: TStream) => Promise<LDAIMetrics>,
  ): TStream {
    const startTime = Date.now();

    try {
      // Create the stream synchronously
      const stream = streamCreator();

      // Start background metrics tracking (fire and forget)
      this._trackStreamMetricsInBackground(stream, metricsExtractor, startTime);

      // Return stream immediately for consumption
      return stream;
    } catch (error) {
      // Track error if stream creation fails
      this.trackDuration(Date.now() - startTime);
      this.trackError();
      throw error;
    }
  }

  private async _trackStreamMetricsInBackground<TStream>(
    stream: TStream,
    metricsExtractor: (stream: TStream) => Promise<LDAIMetrics>,
    startTime: number,
  ): Promise<void> {
    try {
      // Wait for metrics to be available
      const metrics = await metricsExtractor(stream);

      // Track success/error based on metrics
      if (metrics.success) {
        this.trackSuccess();
      } else {
        this.trackError();
      }

      // Track token usage if available
      if (metrics.usage) {
        this.trackTokens(metrics.usage);
      }
    } catch (error) {
      // If metrics extraction fails, track error
      this.trackError();
    } finally {
      // Track duration regardless of success/error
      this.trackDuration(Date.now() - startTime);
    }
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
        inputTokens?: number;
        promptTokens?: number;
        outputTokens?: number;
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

  trackTokens(tokens: LDTokenUsage): void {
    this._trackedMetrics.tokens = tokens;
    const trackData = this.getTrackData();
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
