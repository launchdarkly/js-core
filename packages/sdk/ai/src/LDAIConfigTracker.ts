import { LDClient, LDContext } from '@launchdarkly/node-server-sdk';

import {
  createBedrockTokenUsage,
  FeedbackKind,
  OpenAITokenUsage,
  TokenMetrics,
  TokenUsage,
  UnderScoreTokenUsage,
} from './api/metrics';

export class LDAIConfigTracker {
  private ldClient: LDClient;
  private variationId: string;
  private configKey: string;
  private context: LDContext;

  constructor(ldClient: LDClient, configKey: string, versionId: string, context: LDContext) {
    this.ldClient = ldClient;
    this.variationId = versionId;
    this.configKey = configKey;
    this.context = context;
  }

  private _getTrackData(): { variationId: string; configKey: string } {
    return {
      variationId: this.variationId,
      configKey: this.configKey,
    };
  }

  trackDuration(duration: number): void {
    this.ldClient.track('$ld:ai:duration:total', this.context, this._getTrackData(), duration);
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
    this.ldClient.track('$ld:ai:error', this.context, this._getTrackData(), error);
  }

  trackFeedback(feedback: { kind: FeedbackKind }): void {
    if (feedback.kind === FeedbackKind.Positive) {
      this.ldClient.track('$ld:ai:feedback:user:positive', this.context, this._getTrackData(), 1);
    } else if (feedback.kind === FeedbackKind.Negative) {
      this.ldClient.track('$ld:ai:feedback:user:negative', this.context, this._getTrackData(), 1);
    }
  }

  trackGeneration(generation: number): void {
    this.ldClient.track('$ld:ai:generation', this.context, this._getTrackData(), generation);
  }

  async trackOpenAI(func: (...args: any[]) => Promise<any>, ...args: any[]): Promise<any> {
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

  trackTokens(
    tokens:
      | TokenUsage
      | UnderScoreTokenUsage
      | { totalTokens: number; inputTokens: number; outputTokens: number },
  ): void {
    const tokenMetrics = toMetrics(tokens);
    if (tokenMetrics.total > 0) {
      this.ldClient.track(
        '$ld:ai:tokens:total',
        this.context,
        this._getTrackData(),
        tokenMetrics.total,
      );
    }
    if (tokenMetrics.input > 0) {
      this.ldClient.track(
        '$ld:ai:tokens:input',
        this.context,
        this._getTrackData(),
        tokenMetrics.input,
      );
    }
    if (tokenMetrics.output > 0) {
      this.ldClient.track(
        '$ld:ai:tokens:output',
        this.context,
        this._getTrackData(),
        tokenMetrics.output,
      );
    }
  }
}

function toMetrics(
  usage:
    | TokenUsage
    | UnderScoreTokenUsage
    | { totalTokens: number; inputTokens: number; outputTokens: number },
): TokenMetrics {
  if ('inputTokens' in usage && 'outputTokens' in usage) {
    // Bedrock usage
    return {
      total: usage.totalTokens,
      input: usage.inputTokens,
      output: usage.outputTokens,
    };
  }

  // OpenAI usage (both camelCase and snake_case)
  return {
    total: 'total_tokens' in usage ? usage.total_tokens! : ((usage as TokenUsage).totalTokens ?? 0),
    input:
      'prompt_tokens' in usage ? usage.prompt_tokens! : ((usage as TokenUsage).promptTokens ?? 0),
    output:
      'completion_tokens' in usage
        ? usage.completion_tokens!
        : ((usage as TokenUsage).completionTokens ?? 0),
  };
}
