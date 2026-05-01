import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import {
  convertMessagesToLangChain,
  getAIMetricsFromResponse,
  getAIUsageFromResponse,
  mapProviderName,
} from '../src/langchainHelper';

describe('convertMessagesToLangChain', () => {
  it('converts system, user, and assistant messages to LangChain instances', () => {
    const result = convertMessagesToLangChain([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'u' },
      { role: 'assistant', content: 'a' },
    ]);

    expect(result).toHaveLength(3);
    expect(result[0]).toBeInstanceOf(SystemMessage);
    expect(result[1]).toBeInstanceOf(HumanMessage);
    expect(result[2]).toBeInstanceOf(AIMessage);
  });

  it('throws on an unsupported role', () => {
    expect(() => convertMessagesToLangChain([{ role: 'tool' as any, content: 'x' }])).toThrow(
      'Unsupported message role: tool',
    );
  });
});

describe('mapProviderName', () => {
  it('maps gemini to google-genai (case-insensitive)', () => {
    expect(mapProviderName('gemini')).toBe('google-genai');
    expect(mapProviderName('Gemini')).toBe('google-genai');
    expect(mapProviderName('GEMINI')).toBe('google-genai');
  });

  it('returns the provider unchanged when no mapping exists', () => {
    expect(mapProviderName('openai')).toBe('openai');
    expect(mapProviderName('anthropic')).toBe('anthropic');
  });
});

describe('getAIUsageFromResponse', () => {
  it('returns undefined when usage_metadata is absent', () => {
    expect(getAIUsageFromResponse(new AIMessage('x'))).toBeUndefined();
  });

  it('maps usage_metadata to LDTokenUsage', () => {
    const message = new AIMessage('x');
    message.usage_metadata = { total_tokens: 30, input_tokens: 10, output_tokens: 20 };
    expect(getAIUsageFromResponse(message)).toEqual({ total: 30, input: 10, output: 20 });
  });
});

describe('getAIMetricsFromResponse', () => {
  it('returns success=true with usage from the response', () => {
    const message = new AIMessage('x');
    message.usage_metadata = { total_tokens: 3, input_tokens: 1, output_tokens: 2 };
    expect(getAIMetricsFromResponse(message)).toEqual({
      success: true,
      usage: { total: 3, input: 1, output: 2 },
    });
  });
});
