import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDAIConfigTracker } from './api/config';
import { LDAIMetricSummary } from './api/model/types';
import { LDJudgeResult } from './api/judge/types';
import { LDAIMetrics, LDFeedbackKind, LDTokenUsage } from './api/metrics';
import { LDClientMin } from './LDClientMin';

export class LDAIConfigTrackerImpl implements LDAIConfigTracker {
  private _trackedMetrics: LDAIMetricSummary = {};

  constructor(
    private _ldClient: LDClientMin,
    private _runId: string,
    private _configKey: string,
    private _variationKey: string,
    private _version: number,
    private _modelName: string,
    private _providerName: string,
    private _context: LDContext,
    private _graphKey?: string,
    private _modelKey?: string,
    private _modelVersion: number = 1,
  ) {
    this._trackedMetrics.resumptionToken = this.resumptionToken;
  }

  getTrackData(): {
    runId: string;
    configKey: string;
    variationKey: string;
    version: number;
    modelName: string;
    providerName: string;
    modelVersion: number;
    modelKey?: string;
    graphKey?: string;
  } {
    return {
      runId: this._runId,
      configKey: this._configKey,
      variationKey: this._variationKey,
      version: this._version,
      modelName: this._modelName,
      providerName: this._providerName,
      modelVersion: this._modelVersion,
      ...(this._modelKey ? { modelKey: this._modelKey } : {}),
      ...(this._graphKey !== undefined ? { graphKey: this._graphKey } : {}),
    };
  }

  get resumptionToken(): string {
    const json = JSON.stringify({
      runId: this._runId,
      configKey: this._configKey,
      variationKey: this._variationKey,
      version: this._version,
      ...(this._graphKey !== undefined ? { graphKey: this._graphKey } : {}),
    });
    return Buffer.from(json).toString('base64url');
  }

  static fromResumptionToken(
    token: string,
    ldClient: LDClientMin,
    context: LDContext,
  ): LDAIConfigTrackerImpl {
    const json = Buffer.from(token, 'base64url').toString('utf8');
    const payload = JSON.parse(json);
    return new LDAIConfigTrackerImpl(
      ldClient,
      payload.runId,
      payload.configKey,
      payload.variationKey ?? '',
      payload.version,
      '',
      '',
      context,
      payload.graphKey,
    );
  }

  trackDuration(duration: number): void {
    if (this._trackedMetrics.durationMs !== undefined) {
      this._ldClient.logger?.warn(
        'Skipping trackDuration: duration already recorded on this tracker. Call createTracker on the AI Config for a new run.',
      );
      return;
    }
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
    if (this._trackedMetrics.timeToFirstTokenMs !== undefined) {
      this._ldClient.logger?.warn(
        'Skipping trackTimeToFirstToken: time-to-first-token already recorded on this tracker. Call createTracker on the AI Config for a new run.',
      );
      return;
    }
    this._trackedMetrics.timeToFirstTokenMs = timeToFirstTokenMs;
    this._ldClient.track(
      '$ld:ai:tokens:ttf',
      this._context,
      this.getTrackData(),
      timeToFirstTokenMs,
    );
  }

  trackJudgeResult(result: LDJudgeResult) {
    if (!result.sampled || !result.success) {
      return;
    }
    if (result.metricKey !== undefined && result.score !== undefined) {
      const trackData = result.judgeConfigKey
        ? { ...this.getTrackData(), judgeConfigKey: result.judgeConfigKey }
        : this.getTrackData();
      this._ldClient.track(result.metricKey, this._context, trackData, result.score);
    }
  }

  trackToolCall(toolKey: string): void {
    if (!this._trackedMetrics.toolCalls) {
      this._trackedMetrics.toolCalls = [];
    }
    this._trackedMetrics.toolCalls.push(toolKey);
    this._ldClient.track('$ld:ai:tool_call', this._context, { ...this.getTrackData(), toolKey }, 1);
  }

  trackToolCalls(toolKeys: string[]): void {
    toolKeys.forEach((toolKey) => {
      this.trackToolCall(toolKey);
    });
  }

  trackFeedback(feedback: { kind: LDFeedbackKind }): void {
    if (this._trackedMetrics.feedback !== undefined) {
      this._ldClient.logger?.warn(
        'Skipping trackFeedback: feedback already recorded on this tracker. Call createTracker on the AI Config for a new run.',
      );
      return;
    }
    this._trackedMetrics.feedback = feedback;
    if (feedback.kind === LDFeedbackKind.Positive) {
      this._ldClient.track('$ld:ai:feedback:user:positive', this._context, this.getTrackData(), 1);
    } else if (feedback.kind === LDFeedbackKind.Negative) {
      this._ldClient.track('$ld:ai:feedback:user:negative', this._context, this.getTrackData(), 1);
    }
  }

  trackSuccess(): void {
    if (this._trackedMetrics.success !== undefined) {
      this._ldClient.logger?.warn(
        'Skipping trackSuccess: success/error already recorded on this tracker. Call createTracker on the AI Config for a new run.',
      );
      return;
    }
    this._trackedMetrics.success = true;
    this._ldClient.track('$ld:ai:generation:success', this._context, this.getTrackData(), 1);
  }

  trackError(): void {
    if (this._trackedMetrics.success !== undefined) {
      this._ldClient.logger?.warn(
        'Skipping trackError: success/error already recorded on this tracker. Call createTracker on the AI Config for a new run.',
      );
      return;
    }
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
    if (metrics.tokens) {
      this.trackTokens(metrics.tokens);
    }

    // Track tool calls if available
    if (metrics.toolCalls?.length) {
      this.trackToolCalls(metrics.toolCalls);
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
      if (metrics.tokens) {
        this.trackTokens(metrics.tokens);
      }

      // Track tool calls if available
      if (metrics.toolCalls?.length) {
        this.trackToolCalls(metrics.toolCalls);
      }
    } catch (error) {
      // If metrics extraction fails, track error
      this.trackError();
    } finally {
      // Track duration regardless of success/error
      this.trackDuration(Date.now() - startTime);
    }
  }

  trackTokens(tokens: LDTokenUsage): void {
    if (this._trackedMetrics.tokens !== undefined) {
      this._ldClient.logger?.warn(
        'Skipping trackTokens: token usage already recorded on this tracker. Call createTracker on the AI Config for a new run.',
      );
      return;
    }
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
