export interface TokenMetrics {
  total: number;
  input: number;
  output: number;
}

export interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

export interface UnderscoreTokenUsage {
  completion_tokens?: number;
  prompt_tokens?: number;
  total_tokens?: number;
}

export interface BedrockTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export enum FeedbackKind {
  Positive = 'positive',
  Negative = 'negative',
}

export interface LDAIConfigTracker {
  trackDuration: (duration: number) => void;
  trackTokens: (tokens: TokenUsage | UnderscoreTokenUsage | BedrockTokenUsage) => void;
  trackError: (error: number) => void;
  trackGeneration: (generation: number) => void;
  trackFeedback: (feedback: { kind: FeedbackKind }) => void;
}
/**
 * AI Config value and tracker.
 */
export interface LDAIConfig {
  /**
   * The result of the AI Config evaluation.
   */
  config: unknown;

  /**
   * A tracker which can be used to generate analytics for the migration.
   */
  tracker: LDAIConfigTracker;
}
