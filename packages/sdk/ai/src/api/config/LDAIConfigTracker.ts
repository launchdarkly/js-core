import { FeedbackKind, TokenUsage, UnderscoreTokenUsage } from '../metrics';

export interface LDAIConfigTracker {
  trackDuration: (duration: number) => void;
  trackTokens: (
    tokens:
      | TokenUsage
      | UnderscoreTokenUsage
      | { totalTokens: number; inputTokens: number; outputTokens: number },
  ) => void;
  trackError: (error: number) => void;
  trackGeneration: (generation: number) => void;
  trackFeedback: (feedback: { kind: FeedbackKind }) => void;
  trackDurationOf: (func: (...args: any[]) => Promise<any>, ...args: any[]) => Promise<any>;
  trackOpenAI: (func: Function, ...args: any[]) => any;
  trackBedrockConverse: (res: any) => any;
}
