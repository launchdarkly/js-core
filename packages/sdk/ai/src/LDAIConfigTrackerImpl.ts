import { LDClient, LDContext } from '@launchdarkly/node-server-sdk';

import { LDAIConfigTracker } from './api/config';
import { createBedrockTokenUsage, FeedbackKind, TokenUsage } from './api/metrics';
import { createOpenAiUsage } from './api/metrics/OpenAiUsage';

export class LDAIConfigTrackerImpl implements LDAIConfigTracker {
  private _ldClient: LDClient;
  private _variationId: string;
  private _configKey: string;
  private _context: LDContext;

  constructor(ldClient: LDClient, configKey: string, versionId: string, context: LDContext) {
    this._ldClient = ldClient;
    this._variationId = versionId;
    this._configKey = configKey;
    this._context = context;
  }

  private _getTrackData(): { variationId: string; configKey: string } {
    return {
      variationId: this._variationId,
      configKey: this._configKey,
    };
  }

  trackDuration(duration: number): void {
    this._ldClient.track('$ld:ai:duration:total', this._context, this._getTrackData(), duration);
  }

  async trackDurationOf(func: (...args: any[]) => Promise<any>, ...args: any[]): Promise<any> {
    const startTime = Date.now();
    const result = await func(...args);
    const endTime = Date.now();
    const duration = endTime - startTime; // duration in milliseconds
    this.trackDuration(duration);
    return result;
  }

  trackError(error: number): void {
    this._ldClient.track('$ld:ai:error', this._context, this._getTrackData(), error);
  }

  trackFeedback(feedback: { kind: FeedbackKind }): void {
    if (feedback.kind === FeedbackKind.Positive) {
      this._ldClient.track('$ld:ai:feedback:user:positive', this._context, this._getTrackData(), 1);
    } else if (feedback.kind === FeedbackKind.Negative) {
      this._ldClient.track('$ld:ai:feedback:user:negative', this._context, this._getTrackData(), 1);
    }
  }

  trackGeneration(generation: number): void {
    this._ldClient.track('$ld:ai:generation', this._context, this._getTrackData(), generation);
  }

  async trackOpenAI(func: (...args: any[]) => Promise<any>, ...args: any[]): Promise<any> {
    const result = await this.trackDurationOf(func, ...args);
    this.trackGeneration(1);
    if (result.usage) {
      this.trackTokens(createOpenAiUsage(result.usage));
    }
    return result;
  }

  async trackBedrockConverse(res: {
    $metadata?: { httpStatusCode: number };
    metrics?: { latencyMs: number };
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  }): Promise<any> {
    if (res.$metadata?.httpStatusCode === 200) {
      this.trackGeneration(1);
    } else if (res.$metadata?.httpStatusCode && res.$metadata.httpStatusCode >= 400) {
      this.trackError(res.$metadata.httpStatusCode);
    }
    if (res.metrics) {
      this.trackDuration(res.metrics.latencyMs);
    }
    if (res.usage) {
      this.trackTokens(createBedrockTokenUsage(res.usage));
    }
    return res;
  }

  trackTokens(tokens: TokenUsage): void {
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
