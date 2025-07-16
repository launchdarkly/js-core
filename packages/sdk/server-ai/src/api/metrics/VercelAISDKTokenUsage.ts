import { LDTokenUsage } from './LDTokenUsage';

export function createVercelAISDKTokenUsage(data: {
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}): LDTokenUsage {
  return {
    total: data.totalTokens ?? 0,
    input: data.promptTokens ?? 0,
    output: data.completionTokens ?? 0,
  };
}
