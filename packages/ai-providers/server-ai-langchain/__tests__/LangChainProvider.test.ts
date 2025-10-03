import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import { LangChainProvider } from '../src/LangChainProvider';

// Mock LangChain dependencies
jest.mock('langchain/chat_models/universal', () => ({
  initChatModel: jest.fn(),
}));

describe('LangChainProvider', () => {
  describe('convertMessagesToLangChain', () => {
    it('converts system messages to SystemMessage', () => {
      const messages = [{ role: 'system' as const, content: 'You are a helpful assistant.' }];
      const result = LangChainProvider.convertMessagesToLangChain(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(SystemMessage);
      expect(result[0].content).toBe('You are a helpful assistant.');
    });

    it('converts user messages to HumanMessage', () => {
      const messages = [{ role: 'user' as const, content: 'Hello, how are you?' }];
      const result = LangChainProvider.convertMessagesToLangChain(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(HumanMessage);
      expect(result[0].content).toBe('Hello, how are you?');
    });

    it('converts assistant messages to AIMessage', () => {
      const messages = [{ role: 'assistant' as const, content: 'I am doing well, thank you!' }];
      const result = LangChainProvider.convertMessagesToLangChain(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(AIMessage);
      expect(result[0].content).toBe('I am doing well, thank you!');
    });

    it('converts multiple messages in order', () => {
      const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant.' },
        { role: 'user' as const, content: 'What is the weather like?' },
        { role: 'assistant' as const, content: 'I cannot check the weather.' },
      ];
      const result = LangChainProvider.convertMessagesToLangChain(messages);

      expect(result).toHaveLength(3);
      expect(result[0]).toBeInstanceOf(SystemMessage);
      expect(result[1]).toBeInstanceOf(HumanMessage);
      expect(result[2]).toBeInstanceOf(AIMessage);
    });

    it('throws error for unsupported message role', () => {
      const messages = [{ role: 'unknown' as any, content: 'Test message' }];

      expect(() => LangChainProvider.convertMessagesToLangChain(messages)).toThrow(
        'Unsupported message role: unknown',
      );
    });

    it('handles empty message array', () => {
      const result = LangChainProvider.convertMessagesToLangChain([]);

      expect(result).toHaveLength(0);
    });
  });

  describe('createAIMetrics', () => {
    it('creates metrics with success=true and token usage', () => {
      const mockResponse = new AIMessage('Test response');
      mockResponse.response_metadata = {
        tokenUsage: {
          totalTokens: 100,
          promptTokens: 50,
          completionTokens: 50,
        },
      };

      const result = LangChainProvider.createAIMetrics(mockResponse);

      expect(result).toEqual({
        success: true,
        usage: {
          total: 100,
          input: 50,
          output: 50,
        },
      });
    });

    it('creates metrics with success=true and no usage when metadata is missing', () => {
      const mockResponse = new AIMessage('Test response');

      const result = LangChainProvider.createAIMetrics(mockResponse);

      expect(result).toEqual({
        success: true,
        usage: undefined,
      });
    });
  });

  describe('mapProvider', () => {
    it('maps gemini to google-genai', () => {
      expect(LangChainProvider.mapProvider('gemini')).toBe('google-genai');
      expect(LangChainProvider.mapProvider('Gemini')).toBe('google-genai');
      expect(LangChainProvider.mapProvider('GEMINI')).toBe('google-genai');
    });

    it('returns provider name unchanged for unmapped providers', () => {
      expect(LangChainProvider.mapProvider('openai')).toBe('openai');
      expect(LangChainProvider.mapProvider('anthropic')).toBe('anthropic');
      expect(LangChainProvider.mapProvider('unknown')).toBe('unknown');
    });
  });
});
