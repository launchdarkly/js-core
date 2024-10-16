import { LDClient, LDContext } from '@launchdarkly/node-server-sdk';

import { BedrockTokenUsage, FeedbackKind, TokenUsage, UnderscoreTokenUsage } from './api/metrics';
import { usageToTokenMetrics } from './trackUtils';

export class LDAIConfigTracker {
  private ldClient: LDClient;
  private configKey: string;
  private variationId: string;
  private context: LDContext;

  constructor(ldClient: LDClient, configKey: string, variationId: string, context: LDContext) {
    this.ldClient = ldClient;
    this.configKey = configKey;
    this.variationId = variationId;
    this.context = context;
  }

  getTrackData() {
    return {
      configKey: this.configKey,
      variationId: this.variationId,
    };
  }

  trackDuration(duration: number): void {
    this.ldClient.track('$ld:ai:duration:total', this.context, this.variationId, duration);
  }

  trackTokens(tokens: TokenUsage | UnderscoreTokenUsage | BedrockTokenUsage) {
    console.log('tracking LLM tokens', tokens);
    const tokenMetrics = usageToTokenMetrics(tokens);
    console.log('token metrics', tokenMetrics);
    if (tokenMetrics.total > 0) {
      this.ldClient.track(
        '$ld:ai:tokens:total',
        this.context,
        this.getTrackData(),
        tokenMetrics.total,
      );
    }
    if (tokenMetrics.input > 0) {
      console.log('tracking input tokens', tokenMetrics.input);
      this.ldClient.track(
        '$ld:ai:tokens:input',
        this.context,
        this.getTrackData(),
        tokenMetrics.input,
      );
    }
    if (tokenMetrics.output > 0) {
      console.log('tracking output tokens', tokenMetrics.output);
      this.ldClient.track(
        '$ld:ai:tokens:output',
        this.context,
        this.getTrackData(),
        tokenMetrics.output,
      );
    }
  }

  trackError(error: number) {
    this.ldClient.track('$ld:ai:error', this.context, this.getTrackData(), error);
  }

  trackGeneration(generation: number) {
    this.ldClient.track('$ld:ai:generation', this.context, this.getTrackData(), generation);
  }

  trackFeedback(feedback: { kind: FeedbackKind }) {
    if (feedback.kind === FeedbackKind.Positive) {
      this.ldClient.track('$ld:ai:feedback:user:positive', this.context, this.getTrackData(), 1);
    } else if (feedback.kind === FeedbackKind.Negative) {
      this.ldClient.track('$ld:ai:feedback:user:negative', this.context, this.getTrackData(), 1);
    }
  }
}
