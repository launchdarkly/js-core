import { TokenUsage } from './TokenUsage';

export function createOpenAiUsage(data: any): TokenUsage {
  return {
    total: data.total_tokens ?? 0,
    input: data.prompt_token ?? 0,
    output: data.completion_token ?? 0,
  };
}
