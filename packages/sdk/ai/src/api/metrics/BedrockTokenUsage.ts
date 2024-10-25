export class BedrockTokenUsage {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;

  constructor(data: any) {
    this.totalTokens = data.totalTokens || 0;
    this.inputTokens = data.inputTokens || 0;
    this.outputTokens = data.outputTokens || 0;
  }

  toMetrics() {
    return {
      total: this.totalTokens,
      input: this.inputTokens,
      output: this.outputTokens,
    };
  }
}
