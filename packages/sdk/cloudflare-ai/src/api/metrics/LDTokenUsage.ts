/**
 * Token usage tracking for AI operations.
 */
export interface LDTokenUsage {
  /**
   * Number of input tokens used.
   */
  inputTokens: number;

  /**
   * Number of output tokens generated.
   */
  outputTokens: number;

  /**
   * Total tokens used (input + output).
   */
  totalTokens: number;
}
