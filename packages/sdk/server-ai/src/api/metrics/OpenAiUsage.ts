import { LDTokenUsage } from './LDTokenUsage';

export function createOpenAiUsage(data: any): LDTokenUsage {
  return {
    total: data.total_tokens ?? 0,
    input: data.prompt_token ?? 0,
    output: data.completion_token ?? 0,
  };
}
