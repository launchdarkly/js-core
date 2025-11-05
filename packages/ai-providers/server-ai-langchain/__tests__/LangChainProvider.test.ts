import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import { LangChainProvider } from '../src/LangChainProvider';

// Mock LangChain dependencies
jest.mock('langchain/chat_models/universal', () => ({
  initChatModel: jest.fn(),
}));

// Mock logger
const mockLogger = {
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

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

  describe('getAIMetricsFromResponse', () => {
    it('creates metrics with success=true and token usage', () => {
      const mockResponse = new AIMessage('Test response');
      mockResponse.response_metadata = {
        tokenUsage: {
          totalTokens: 100,
          promptTokens: 50,
          completionTokens: 50,
        },
      };

      const result = LangChainProvider.getAIMetricsFromResponse(mockResponse);

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

      const result = LangChainProvider.getAIMetricsFromResponse(mockResponse);

      expect(result).toEqual({
        success: true,
        usage: undefined,
      });
    });
  });

  describe('invokeModel', () => {
    let mockLLM: any;
    let provider: LangChainProvider;

    beforeEach(() => {
      mockLLM = {
        invoke: jest.fn(),
      };
      provider = new LangChainProvider(mockLLM, mockLogger);
      jest.clearAllMocks();
    });

    it('returns success=true for string content', async () => {
      const mockResponse = new AIMessage('Test response');
      mockLLM.invoke.mockResolvedValue(mockResponse);

      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const result = await provider.invokeModel(messages);

      expect(result.metrics.success).toBe(true);
      expect(result.message.content).toBe('Test response');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('returns success=false for non-string content and logs warning', async () => {
      const mockResponse = new AIMessage({ type: 'image', data: 'base64data' } as any);
      mockLLM.invoke.mockResolvedValue(mockResponse);

      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const result = await provider.invokeModel(messages);

      expect(result.metrics.success).toBe(false);
      expect(result.message.content).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });

    it('returns success=false for array content and logs warning', async () => {
      const mockResponse = new AIMessage(['text', { type: 'image', data: 'base64data' }] as any);
      mockLLM.invoke.mockResolvedValue(mockResponse);

      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const result = await provider.invokeModel(messages);

      expect(result.metrics.success).toBe(false);
      expect(result.message.content).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });

    it('returns success=false when model invocation throws an error', async () => {
      const error = new Error('Model invocation failed');
      mockLLM.invoke.mockRejectedValue(error);

      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const result = await provider.invokeModel(messages);

      expect(result.metrics.success).toBe(false);
      expect(result.message.content).toBe('');
      expect(result.message.role).toBe('assistant');
      expect(mockLogger.error).toHaveBeenCalledWith('LangChain model invocation failed:', error);
    });
  });

  describe('invokeStructuredModel', () => {
    let mockLLM: any;
    let provider: LangChainProvider;

    beforeEach(() => {
      mockLLM = {
        withStructuredOutput: jest.fn(),
      };
      provider = new LangChainProvider(mockLLM, mockLogger);
      jest.clearAllMocks();
    });

    it('returns success=true for successful invocation', async () => {
      const mockResponse = { result: 'structured data' };
      const mockInvoke = jest.fn().mockResolvedValue(mockResponse);
      mockLLM.withStructuredOutput.mockReturnValue({ invoke: mockInvoke });

      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const responseStructure = { type: 'object', properties: {} };
      const result = await provider.invokeStructuredModel(messages, responseStructure);

      expect(result.metrics.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(result.rawResponse).toBe(JSON.stringify(mockResponse));
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('returns success=false when structured model invocation throws an error', async () => {
      const error = new Error('Structured invocation failed');
      const mockInvoke = jest.fn().mockRejectedValue(error);
      mockLLM.withStructuredOutput.mockReturnValue({ invoke: mockInvoke });

      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const responseStructure = { type: 'object', properties: {} };
      const result = await provider.invokeStructuredModel(messages, responseStructure);

      expect(result.metrics.success).toBe(false);
      expect(result.data).toEqual({});
      expect(result.rawResponse).toBe('');
      expect(result.metrics.usage).toEqual({ total: 0, input: 0, output: 0 });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'LangChain structured model invocation failed:',
        error,
      );
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
