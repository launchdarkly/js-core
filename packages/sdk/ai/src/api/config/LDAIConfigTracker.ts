export interface LDAIConfigTracker {
	trackDuration: (duration: number) => void;
	trackTokens: (tokens: TokenUsage | UnderscoreTokenUsage | BedrockTokenUsage) => void;
	trackError: (error: number) => void;
	trackGeneration: (generation: number) => void;
	trackFeedback: (feedback: { kind: FeedbackKind }) => void;
}