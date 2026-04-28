import {
  convertMessagesToVercel,
  getAIMetricsFromResponse,
  getAIMetricsFromStream,
  mapProviderName,
  mapUsageDataToLDTokenUsage,
} from '../src/vercelHelper';

describe('convertMessagesToVercel', () => {
  it('passes role and content through unchanged', () => {
    expect(
      convertMessagesToVercel([
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'u' },
        { role: 'assistant', content: 'a' },
      ]),
    ).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'u' },
      { role: 'assistant', content: 'a' },
    ]);
  });
});

describe('mapProviderName', () => {
  it('maps gemini to google (case-insensitive)', () => {
    expect(mapProviderName('gemini')).toBe('google');
    expect(mapProviderName('Gemini')).toBe('google');
  });

  it('returns the provider unchanged when no mapping exists', () => {
    expect(mapProviderName('openai')).toBe('openai');
    expect(mapProviderName('anthropic')).toBe('anthropic');
  });
});

describe('mapUsageDataToLDTokenUsage', () => {
  it('prefers v5 field names (inputTokens / outputTokens) over v4', () => {
    const usage = mapUsageDataToLDTokenUsage({
      totalTokens: 100,
      inputTokens: 40,
      outputTokens: 60,
      promptTokens: 1,
      completionTokens: 2,
    });
    expect(usage).toEqual({ total: 100, input: 40, output: 60 });
  });

  it('falls back to v4 field names when v5 is absent', () => {
    const usage = mapUsageDataToLDTokenUsage({
      totalTokens: 50,
      promptTokens: 20,
      completionTokens: 30,
    });
    expect(usage).toEqual({ total: 50, input: 20, output: 30 });
  });
});

describe('getAIMetricsFromResponse', () => {
  it('treats missing finishReason as success', () => {
    expect(
      getAIMetricsFromResponse({
        usage: { totalTokens: 5, promptTokens: 2, completionTokens: 3 },
      }),
    ).toEqual({ success: true, usage: { total: 5, input: 2, output: 3 } });
  });

  it('marks success=false when finishReason is "error"', () => {
    expect(
      getAIMetricsFromResponse({
        finishReason: 'error',
        usage: { totalTokens: 10, promptTokens: 4, completionTokens: 6 },
      }).success,
    ).toBe(false);
  });
});

describe('getAIMetricsFromStream', () => {
  it('extracts usage from a successful stream', async () => {
    const result = await getAIMetricsFromStream({
      finishReason: Promise.resolve('stop'),
      usage: Promise.resolve({ totalTokens: 100, promptTokens: 49, completionTokens: 51 }),
    });
    expect(result).toEqual({
      success: true,
      usage: { total: 100, input: 49, output: 51 },
    });
  });

  it('marks success=false on error finishReason', async () => {
    const result = await getAIMetricsFromStream({
      finishReason: Promise.resolve('error'),
    });
    expect(result.success).toBe(false);
  });
});
