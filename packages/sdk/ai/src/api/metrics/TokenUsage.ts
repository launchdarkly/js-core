export class TokenUsage {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;

  constructor(data: any) {
    this.totalTokens = data.total_tokens || 0;
    this.promptTokens = data.prompt_tokens || 0;
    this.completionTokens = data.completion_tokens || 0;
  }

  toMetrics() {
    return {
      total: this.totalTokens,
      input: this.promptTokens,
      output: this.completionTokens,
    };
  }
}
