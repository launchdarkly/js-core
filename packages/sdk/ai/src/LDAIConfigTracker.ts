import { LDClient, LDContext } from '@launchdarkly/node-server-sdk';

import {
  BedrockTokenUsage,
  createBedrockTokenUsage,
  FeedbackKind,
  OpenAITokenUsage,
  TokenUsage,
  UnderscoreTokenUsage,
} from './api/metrics';

export class LDAIConfigTracker {
  private ldClient: LDClient;
  private variationId: string;
  private configKey: string;
  private context: LDContext;

  constructor(ldClient: LDClient, configKey: string, variationId: string, context: LDContext) {
    this.ldClient = ldClient;
    this.variationId = variationId;
    this.configKey = configKey;
    this.context = context;
  }

  private getTrackData() {
    return {
      variationId: this.variationId,
      configKey: this.configKey,
    };
  }

  trackDuration(duration: number): void {
    this.ldClient.track('$ld:ai:duration:total', this.context, this.getTrackData(), duration);
  }

  async trackDurationOf(func: Function, ...args: any[]): Promise<any> {
    const startTime = Date.now();
    const result = await func(...args);
    const endTime = Date.now();
    const duration = endTime - startTime; // duration in milliseconds
    this.trackDuration(duration);
    return result;
  }

  trackError(error: number): void {
    this.ldClient.track('$ld:ai:error', this.context, this.getTrackData(), error);
  }

  trackFeedback(feedback: { kind: FeedbackKind }): void {
    if (feedback.kind === FeedbackKind.Positive) {
      this.ldClient.track('$ld:ai:feedback:user:positive', this.context, this.getTrackData(), 1);
    } else if (feedback.kind === FeedbackKind.Negative) {
      this.ldClient.track('$ld:ai:feedback:user:negative', this.context, this.getTrackData(), 1);
    }
  }

  trackGeneration(generation: number): void {
    this.ldClient.track('$ld:ai:generation', this.context, this.getTrackData(), generation);
  }

  async trackOpenAI(func: Function, ...args: any[]): Promise<any> {
    const result = await this.trackDurationOf(func, ...args);
    this.trackGeneration(1);
    if (result.usage) {
      this.trackTokens(new OpenAITokenUsage(result.usage));
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

  trackTokens(tokens: TokenUsage | UnderscoreTokenUsage | BedrockTokenUsage): void {
    const tokenMetrics = tokens.toMetrics();
    if (tokenMetrics.total > 0) {
      this.ldClient.track(
        '$ld:ai:tokens:total',
        this.context,
        this.getTrackData(),
        tokenMetrics.total,
      );
    }
    if (tokenMetrics.input > 0) {
      this.ldClient.track(
        '$ld:ai:tokens:input',
        this.context,
        this.getTrackData(),
        tokenMetrics.input,
      );
    }
    if (tokenMetrics.output > 0) {
      this.ldClient.track(
        '$ld:ai:tokens:output',
        this.context,
        this.getTrackData(),
        tokenMetrics.output,
      );
    }
  }
}
