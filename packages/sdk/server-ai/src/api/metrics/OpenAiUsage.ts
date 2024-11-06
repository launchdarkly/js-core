import { LDTokenUsage } from './LDTokenUsage';

export function createOpenAiUsage(data: {
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
}): LDTokenUsage {
  return {
    total: data.total_tokens ?? 0,
    input: data.prompt_tokens ?? 0,
    output: data.completion_tokens ?? 0,
  };
}
