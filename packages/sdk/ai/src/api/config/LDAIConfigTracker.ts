import { BedrockTokenUsage, FeedbackKind, TokenUsage, UnderscoreTokenUsage } from '../metrics';

export interface LDAIConfigTracker {
  trackDuration: (duration: number) => void;
  trackTokens: (tokens: TokenUsage | UnderscoreTokenUsage | BedrockTokenUsage) => void;
  trackError: (error: number) => void;
  trackGeneration: (generation: number) => void;
  trackFeedback: (feedback: { kind: FeedbackKind }) => void;
  trackDurationOf: (func: Function, ...args: any[]) => any;
  trackOpenAI: (func: Function, ...args: any[]) => any;
  trackBedrockConverse: (res: any) => any;
}
