import { LDTokenUsage } from './LDTokenUsage';

export function createUnderscoreTokenUsage(data: any): LDTokenUsage {
  return {
    total: data.total_tokens || 0,
    input: data.prompt_tokens || 0,
    output: data.completion_tokens || 0,
  };
}
