import { LDTokenUsage } from './LDTokenUsage';

export function createBedrockTokenUsage(data: {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
}): LDTokenUsage {
  return {
    total: data.totalTokens || 0,
    input: data.inputTokens || 0,
    output: data.outputTokens || 0,
  };
}
