import { LDTokenUsage } from './LDTokenUsage';

export function createVercelAISDKTokenUsage(data: {
  totalTokens?: number;
  inputTokens?: number;
  promptTokens?: number;
  outputTokens?: number;
  completionTokens?: number;
}): LDTokenUsage {
  return {
    total: data.totalTokens ?? 0,
    input: data.inputTokens ?? data.promptTokens ?? 0,
    output: data.outputTokens ?? data.completionTokens ?? 0,
  };
}
