import { LDClient, LDContext } from '@launchdarkly/node-server-sdk';

import { usageToTokenMetrics } from './trackUtils';
import { BedrockTokenUsage, FeedbackKind, TokenUsage, UnderscoreTokenUsage } from './types';

export class LDAIConfigTracker {
  private ldClient: LDClient;
  private variationId: Record<string, string>;
  private context: LDContext;

  constructor(ldClient: LDClient, variationId: string, context: LDContext) {
    this.ldClient = ldClient;
    this.variationId = { variationId };
    this.context = context;
  }

  trackDuration(duration: number): void {
    this.ldClient.track('$ld:ai:duration:total', this.context, this.variationId, duration);
  }

  trackTokens(tokens: TokenUsage | UnderscoreTokenUsage | BedrockTokenUsage) {
    const tokenMetrics = usageToTokenMetrics(tokens);
    if (tokenMetrics.total > 0) {
      this.ldClient.track(
        '$ld:ai:tokens:total',
        this.context,
        this.variationId,
        tokenMetrics.total,
      );
    }
    if (tokenMetrics.input > 0) {
      this.ldClient.track(
        '$ld:ai:tokens:input',
        this.context,
        this.variationId,
        tokenMetrics.input,
      );
    }
    if (tokenMetrics.output > 0) {
      this.ldClient.track(
        '$ld:ai:tokens:output',
        this.context,
        this.variationId,
        tokenMetrics.output,
      );
    }
  }

  trackError(error: number) {
    this.ldClient.track('$ld:ai:error', this.context, this.variationId, error);
  }

  trackGeneration(generation: number) {
    this.ldClient.track('$ld:ai:generation', this.context, this.variationId, generation);
  }

  trackFeedback(feedback: { kind: FeedbackKind }) {
    if (feedback.kind === FeedbackKind.Positive) {
      this.ldClient.track('$ld:ai:feedback:user:positive', this.context, this.variationId, 1);
    } else if (feedback.kind === FeedbackKind.Negative) {
      this.ldClient.track('$ld:ai:feedback:user:negative', this.context, this.variationId, 1);
    }
  }
}
