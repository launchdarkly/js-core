import {
  convertMessagesToOpenAI,
  getAIMetricsFromResponse,
  getAIUsageFromResponse,
} from '../src/openaiHelper';

describe('convertMessagesToOpenAI', () => {
  it('converts LDMessages to OpenAI message dicts preserving role and content', () => {
    const messages = convertMessagesToOpenAI([
      { role: 'system', content: 'You are X' },
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
    ]);

    expect(messages).toEqual([
      { role: 'system', content: 'You are X' },
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
    ]);
  });
});

describe('getAIUsageFromResponse', () => {
  it('returns undefined when usage is missing', () => {
    expect(getAIUsageFromResponse({})).toBeUndefined();
  });

  it('maps OpenAI prompt/completion/total token fields to LDTokenUsage', () => {
    const usage = getAIUsageFromResponse({
      usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
    });

    expect(usage).toEqual({ total: 15, input: 5, output: 10 });
  });
});

describe('getAIMetricsFromResponse', () => {
  it('returns success=true with usage extracted from the response', () => {
    const metrics = getAIMetricsFromResponse({
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    });

    expect(metrics).toEqual({
      success: true,
      usage: { total: 3, input: 1, output: 2 },
    });
  });
});
