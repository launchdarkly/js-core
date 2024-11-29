/**
 * Information about token usage.
 */
export interface LDTokenUsage {
  /**
   * Combined token usage.
   */
  total: number;

  /**
   * Number of tokens in the input.
   */
  input: number;

  /**
   * Number of tokens in the output.
   */
  output: number;
}
