import { TokenUsage } from './TokenUsage';

export function createUnderscoreTokenUsage(data: any): TokenUsage {
  return {
    total: data.total_tokens || 0,
    input: data.prompt_tokens || 0,
    output: data.completion_tokens || 0,
  };
}
