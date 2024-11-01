export function createBedrockTokenUsage(data: {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
}) {
  return {
    total: data.totalTokens || 0,
    input: data.inputTokens || 0,
    output: data.outputTokens || 0,
  };
}
