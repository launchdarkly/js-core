export class UnderScoreTokenUsage {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;

  constructor(data: any) {
    this.total_tokens = data.total_tokens || 0;
    this.prompt_tokens = data.prompt_tokens || 0;
    this.completion_tokens = data.completion_tokens || 0;
  }

  toMetrics() {
    return {
      total: this.total_tokens,
      input: this.prompt_tokens,
      output: this.completion_tokens,
    };
  }
}
