import { generateObject, generateText, jsonSchema } from 'ai';

import { VercelProvider } from '../src/VercelProvider';

// Mock Vercel AI SDK
jest.mock('ai', () => ({
  generateText: jest.fn(),
  generateObject: jest.fn(),
  jsonSchema: jest.fn((schema) => schema),
}));

describe('VercelProvider', () => {
  let mockModel: any;
  let provider: VercelProvider;

  beforeEach(() => {
    mockModel = { name: 'test-model' };
    provider = new VercelProvider(mockModel, {});
    jest.clearAllMocks();
  });

  describe('getAIMetricsFromResponse', () => {
    it('creates metrics with success=true and token usage', () => {
      const mockResponse = {
        usage: {
          promptTokens: 50,
          completionTokens: 50,
          totalTokens: 100,
        },
      };

      const result = VercelProvider.getAIMetricsFromResponse(mockResponse);

      expect(result).toEqual({
        success: true,
        usage: {
          total: 100,
          input: 50,
          output: 50,
        },
      });
    });

    it('creates metrics with success=true and no usage when usage is missing', () => {
      const mockResponse = {};

      const result = VercelProvider.getAIMetricsFromResponse(mockResponse);

      expect(result).toEqual({
        success: true,
        usage: undefined,
      });
    });

    it('handles partial usage data', () => {
      const mockResponse = {
        usage: {
          promptTokens: 30,
          // completionTokens and totalTokens missing
        },
      };

      const result = VercelProvider.getAIMetricsFromResponse(mockResponse);

      expect(result).toEqual({
        success: true,
        usage: {
          total: 0,
          input: 30,
          output: 0,
        },
      });
    });

    it('supports v5 field names (inputTokens, outputTokens)', () => {
      const mockResponse = {
        usage: {
          inputTokens: 40,
          outputTokens: 60,
          totalTokens: 100,
        },
      };

      const result = VercelProvider.getAIMetricsFromResponse(mockResponse);

      expect(result).toEqual({
        success: true,
        usage: {
          total: 100,
          input: 40,
          output: 60,
        },
      });
    });

    it('prefers v5 field names over v4 when both are present', () => {
      const mockResponse = {
        usage: {
          // v4 field names
          promptTokens: 10,
          completionTokens: 20,
          // v5 field names (should be preferred)
          inputTokens: 40,
          outputTokens: 60,
          totalTokens: 100,
        },
      };

      const result = VercelProvider.getAIMetricsFromResponse(mockResponse);

      expect(result).toEqual({
        success: true,
        usage: {
          total: 100,
          input: 40, // inputTokens preferred over promptTokens
          output: 60, // outputTokens preferred over completionTokens
        },
      });
    });
  });

  describe('invokeModel', () => {
    it('invokes Vercel AI generateText and returns response', async () => {
      const mockResponse = {
        text: 'Hello! How can I help you today?',
        usage: {
          promptTokens: 10,
          completionTokens: 15,
          totalTokens: 25,
        },
      };

      (generateText as jest.Mock).mockResolvedValue(mockResponse);

      const messages = [{ role: 'user' as const, content: 'Hello!' }];

      const result = await provider.invokeModel(messages);

      expect(generateText).toHaveBeenCalledWith({
        model: mockModel,
        messages: [{ role: 'user', content: 'Hello!' }],
      });

      expect(result).toEqual({
        message: {
          role: 'assistant',
          content: 'Hello! How can I help you today?',
        },
        metrics: {
          success: true,
          usage: {
            total: 25,
            input: 10,
            output: 15,
          },
        },
      });
    });

    it('handles response without usage data', async () => {
      const mockResponse = {
        text: 'Hello! How can I help you today?',
      };

      (generateText as jest.Mock).mockResolvedValue(mockResponse);

      const messages = [{ role: 'user' as const, content: 'Hello!' }];

      const result = await provider.invokeModel(messages);

      expect(result).toEqual({
        message: {
          role: 'assistant',
          content: 'Hello! How can I help you today?',
        },
        metrics: {
          success: true,
          usage: undefined,
        },
      });
    });

    it('handles errors and returns failure metrics', async () => {
      const mockError = new Error('API call failed');
      (generateText as jest.Mock).mockRejectedValue(mockError);

      const mockLogger = {
        warn: jest.fn(),
      };
      provider = new VercelProvider(mockModel, {}, mockLogger as any);

      const messages = [{ role: 'user' as const, content: 'Hello!' }];
      const result = await provider.invokeModel(messages);

      expect(mockLogger.warn).toHaveBeenCalledWith('Vercel AI model invocation failed:', mockError);
      expect(result).toEqual({
        message: {
          role: 'assistant',
          content: '',
        },
        metrics: {
          success: false,
        },
      });
    });
  });

  describe('invokeStructuredModel', () => {
    it('invokes Vercel AI generateObject and returns structured response', async () => {
      const mockResponse = {
        object: {
          name: 'John Doe',
          age: 30,
          isActive: true,
        },
        usage: {
          promptTokens: 10,
          completionTokens: 15,
          totalTokens: 25,
        },
      };

      (generateObject as jest.Mock).mockResolvedValue(mockResponse);

      const messages = [{ role: 'user' as const, content: 'Generate user data' }];
      const responseStructure = {
        name: 'string',
        age: 0,
        isActive: true,
      };

      const result = await provider.invokeStructuredModel(messages, responseStructure);

      expect(generateObject).toHaveBeenCalledWith({
        model: mockModel,
        messages: [{ role: 'user', content: 'Generate user data' }],
        schema: responseStructure,
      });
      expect(jsonSchema).toHaveBeenCalledWith(responseStructure);

      expect(result).toEqual({
        data: {
          name: 'John Doe',
          age: 30,
          isActive: true,
        },
        rawResponse: JSON.stringify({
          name: 'John Doe',
          age: 30,
          isActive: true,
        }),
        metrics: {
          success: true,
          usage: {
            total: 25,
            input: 10,
            output: 15,
          },
        },
      });
    });

    it('handles structured response without usage data', async () => {
      const mockResponse = {
        object: {
          result: 'success',
        },
      };

      (generateObject as jest.Mock).mockResolvedValue(mockResponse);

      const messages = [{ role: 'user' as const, content: 'Generate result' }];
      const responseStructure = {
        result: 'string',
      };

      const result = await provider.invokeStructuredModel(messages, responseStructure);

      expect(result).toEqual({
        data: {
          result: 'success',
        },
        rawResponse: JSON.stringify({
          result: 'success',
        }),
        metrics: {
          success: true,
          usage: undefined,
        },
      });
    });

    it('handles errors and returns failure metrics', async () => {
      const mockError = new Error('API call failed');
      (generateObject as jest.Mock).mockRejectedValue(mockError);

      const mockLogger = {
        warn: jest.fn(),
      };
      provider = new VercelProvider(mockModel, {}, mockLogger as any);

      const messages = [{ role: 'user' as const, content: 'Generate result' }];
      const responseStructure = {
        result: 'string',
      };

      const result = await provider.invokeStructuredModel(messages, responseStructure);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Vercel AI structured model invocation failed:',
        mockError,
      );
      expect(result).toEqual({
        data: {},
        rawResponse: '',
        metrics: {
          success: false,
        },
      });
    });
  });

  describe('getModel', () => {
    it('returns the underlying Vercel AI model', () => {
      const model = provider.getModel();
      expect(model).toBe(mockModel);
    });
  });

  describe('createVercelModel', () => {
    it('creates OpenAI model for openai provider', async () => {
      const mockAiConfig = {
        key: 'test-config',
        model: { name: 'gpt-4', parameters: {} },
        provider: { name: 'openai' },
        enabled: true,
        tracker: {} as any,
        toVercelAISDK: jest.fn(),
      };

      // Mock the dynamic import
      jest.doMock('@ai-sdk/openai', () => ({
        openai: jest.fn().mockReturnValue(mockModel),
      }));

      const result = await VercelProvider.createVercelModel(mockAiConfig);
      expect(result).toBe(mockModel);
    });

    it('throws error for unsupported provider', async () => {
      const mockAiConfig = {
        key: 'test-config',
        model: { name: 'test-model', parameters: {} },
        provider: { name: 'unsupported' },
        enabled: true,
        tracker: {} as any,
        toVercelAISDK: jest.fn(),
      };

      await expect(VercelProvider.createVercelModel(mockAiConfig)).rejects.toThrow(
        'Unsupported Vercel AI provider: unsupported',
      );
    });
  });

  describe('create', () => {
    it('creates VercelProvider with correct model and parameters', async () => {
      const mockAiConfig = {
        key: 'test-config',
        model: {
          name: 'gpt-4',
          parameters: {
            temperature: 0.7,
            maxTokens: 1000,
          },
        },
        provider: { name: 'openai' },
        enabled: true,
        tracker: {} as any,
        toVercelAISDK: jest.fn(),
      };

      // Mock the dynamic import
      jest.doMock('@ai-sdk/openai', () => ({
        openai: jest.fn().mockReturnValue(mockModel),
      }));

      const result = await VercelProvider.create(mockAiConfig);

      expect(result).toBeInstanceOf(VercelProvider);
      expect(result.getModel()).toBeDefined();
    });
  });

  describe('toVercelAISDK', () => {
    const mockToVercelModel = { name: 'mockModel' };
    const mockMessages = [
      { role: 'user' as const, content: 'test prompt' },
      { role: 'system' as const, content: 'test instruction' },
    ];
    const mockOptions = {
      nonInterpolatedMessages: [
        { role: 'assistant' as const, content: 'test assistant instruction' },
      ],
    };
    const mockProvider = jest.fn().mockReturnValue(mockToVercelModel);

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('handles undefined model and messages', () => {
      const aiConfig = {
        key: 'test-config',
        enabled: true,
      };

      const result = VercelProvider.toVercelAISDK(aiConfig, mockProvider);

      expect(mockProvider).toHaveBeenCalledWith('');
      expect(result).toEqual(
        expect.objectContaining({
          model: mockToVercelModel,
          messages: undefined,
        }),
      );
    });

    it('uses additional messages', () => {
      const aiConfig = {
        key: 'test-config',
        model: { name: 'test-ai-model' },
        enabled: true,
      };

      const result = VercelProvider.toVercelAISDK(aiConfig, mockProvider, mockOptions);

      expect(mockProvider).toHaveBeenCalledWith('test-ai-model');
      expect(result).toEqual(
        expect.objectContaining({
          model: mockToVercelModel,
          messages: mockOptions.nonInterpolatedMessages,
        }),
      );
    });

    it('combines config messages and additional messages', () => {
      const aiConfig = {
        key: 'test-config',
        model: { name: 'test-ai-model' },
        messages: mockMessages,
        enabled: true,
      };

      const result = VercelProvider.toVercelAISDK(aiConfig, mockProvider, mockOptions);

      expect(mockProvider).toHaveBeenCalledWith('test-ai-model');
      expect(result).toEqual(
        expect.objectContaining({
          model: mockToVercelModel,
          messages: [...mockMessages, ...(mockOptions.nonInterpolatedMessages ?? [])],
        }),
      );
    });

    it('maps parameters correctly', () => {
      const aiConfig = {
        key: 'test-config',
        model: {
          name: 'test-ai-model',
          parameters: {
            max_tokens: 100,
            temperature: 0.7,
            top_p: 0.9,
            top_k: 50,
            presence_penalty: 0.1,
            frequency_penalty: 0.2,
            stop: ['stop1', 'stop2'],
            seed: 42,
          },
        },
        messages: mockMessages,
        enabled: true,
      };

      const result = VercelProvider.toVercelAISDK(aiConfig, mockProvider);

      expect(mockProvider).toHaveBeenCalledWith('test-ai-model');
      expect(result).toEqual({
        model: mockToVercelModel,
        messages: mockMessages,
        maxTokens: 100,
        temperature: 0.7,
        topP: 0.9,
        topK: 50,
        presencePenalty: 0.1,
        frequencyPenalty: 0.2,
        stopSequences: ['stop1', 'stop2'],
        seed: 42,
      });
    });

    it('handles provider map with provider name', () => {
      const providerMap = {
        openai: jest.fn().mockReturnValue(mockToVercelModel),
        anthropic: jest.fn().mockReturnValue({ name: 'other-model' }),
      };

      const aiConfig = {
        key: 'test-config',
        model: { name: 'test-ai-model' },
        provider: { name: 'openai' },
        enabled: true,
      };

      const result = VercelProvider.toVercelAISDK(aiConfig, providerMap);

      expect(providerMap.openai).toHaveBeenCalledWith('test-ai-model');
      expect(providerMap.anthropic).not.toHaveBeenCalled();
      expect(result.model).toBe(mockToVercelModel);
    });

    it('throws error when model cannot be determined', () => {
      const aiConfig = {
        key: 'test-config',
        model: { name: 'test-ai-model' },
        provider: { name: 'unknown' },
        enabled: true,
      };

      const providerMap = {
        openai: jest.fn().mockReturnValue(mockToVercelModel),
      };

      expect(() => VercelProvider.toVercelAISDK(aiConfig, providerMap)).toThrow(
        'Vercel AI SDK model cannot be determined from the supplied provider parameter.',
      );
    });

    it('throws error when function provider returns undefined', () => {
      const aiConfig = {
        key: 'test-config',
        model: { name: 'test-ai-model' },
        enabled: true,
      };

      const undefinedProvider = jest.fn().mockReturnValue(undefined);

      expect(() => VercelProvider.toVercelAISDK(aiConfig, undefinedProvider)).toThrow(
        'Vercel AI SDK model cannot be determined from the supplied provider parameter.',
      );
    });
  });

  describe('getAIMetricsFromStream', () => {
    it('extracts metrics from successful stream with usage', async () => {
      const mockStream = {
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({
          totalTokens: 100,
          promptTokens: 49,
          completionTokens: 51,
        }),
      };

      const result = await VercelProvider.getAIMetricsFromStream(mockStream);

      expect(result).toEqual({
        success: true,
        usage: {
          total: 100,
          input: 49,
          output: 51,
        },
      });
    });

    it('extracts metrics using totalUsage when available', async () => {
      const mockStream = {
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({
          totalTokens: 50,
          promptTokens: 20,
          completionTokens: 30,
        }),
        totalUsage: Promise.resolve({
          totalTokens: 100,
          promptTokens: 49,
          completionTokens: 51,
        }),
      };

      const result = await VercelProvider.getAIMetricsFromStream(mockStream);

      expect(result).toEqual({
        success: true,
        usage: {
          total: 100,
          input: 49,
          output: 51,
        },
      });
    });

    it('handles stream without usage data', async () => {
      const mockStream = {
        finishReason: Promise.resolve('stop'),
      };

      const result = await VercelProvider.getAIMetricsFromStream(mockStream);

      expect(result).toEqual({
        success: true,
        usage: undefined,
      });
    });

    it('handles error finishReason', async () => {
      const mockStream = {
        finishReason: Promise.resolve('error'),
        usage: Promise.resolve({
          totalTokens: 100,
          promptTokens: 49,
          completionTokens: 51,
        }),
      };

      const result = await VercelProvider.getAIMetricsFromStream(mockStream);

      expect(result).toEqual({
        success: false,
        usage: {
          total: 100,
          input: 49,
          output: 51,
        },
      });
    });

    it('handles rejected finishReason promise', async () => {
      const mockStream = {
        finishReason: Promise.reject(new Error('API error')),
        usage: Promise.resolve({
          totalTokens: 100,
          promptTokens: 49,
          completionTokens: 51,
        }),
      };

      const result = await VercelProvider.getAIMetricsFromStream(mockStream);

      expect(result).toEqual({
        success: false,
        usage: {
          total: 100,
          input: 49,
          output: 51,
        },
      });
    });

    it('handles missing finishReason', async () => {
      const mockStream = {
        usage: Promise.resolve({
          totalTokens: 100,
          promptTokens: 49,
          completionTokens: 51,
        }),
      };

      const result = await VercelProvider.getAIMetricsFromStream(mockStream);

      // When finishReason is missing, it defaults to 'unknown' which is !== 'error', so success is true
      expect(result).toEqual({
        success: true,
        usage: {
          total: 100,
          input: 49,
          output: 51,
        },
      });
    });

    it('handles missing finishReason and usage', async () => {
      const mockStream = {};

      const result = await VercelProvider.getAIMetricsFromStream(mockStream);

      // When finishReason is missing, it defaults to 'unknown' which is !== 'error', so success is true
      expect(result).toEqual({
        success: true,
        usage: undefined,
      });
    });

    it('handles rejected usage promise gracefully', async () => {
      const mockStream = {
        finishReason: Promise.resolve('stop'),
        usage: Promise.reject(new Error('Usage API error')),
      };

      const result = await VercelProvider.getAIMetricsFromStream(mockStream);

      expect(result).toEqual({
        success: true,
        usage: undefined,
      });
    });

    it('handles rejected totalUsage promise and falls back to usage', async () => {
      const mockStream = {
        finishReason: Promise.resolve('stop'),
        totalUsage: Promise.reject(new Error('TotalUsage API error')),
        usage: Promise.resolve({
          totalTokens: 100,
          promptTokens: 49,
          completionTokens: 51,
        }),
      };

      const result = await VercelProvider.getAIMetricsFromStream(mockStream);

      expect(result).toEqual({
        success: true,
        usage: {
          total: 100,
          input: 49,
          output: 51,
        },
      });
    });

    it('handles rejected totalUsage and usage promises gracefully', async () => {
      const mockStream = {
        finishReason: Promise.resolve('stop'),
        totalUsage: Promise.reject(new Error('TotalUsage API error')),
        usage: Promise.reject(new Error('Usage API error')),
      };

      const result = await VercelProvider.getAIMetricsFromStream(mockStream);

      expect(result).toEqual({
        success: true,
        usage: undefined,
      });
    });

    it('supports v4 field names (promptTokens, completionTokens)', async () => {
      const mockStream = {
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({
          totalTokens: 100,
          promptTokens: 40,
          completionTokens: 60,
        }),
      };

      const result = await VercelProvider.getAIMetricsFromStream(mockStream);

      expect(result).toEqual({
        success: true,
        usage: {
          total: 100,
          input: 40,
          output: 60,
        },
      });
    });

    it('supports v5 field names (inputTokens, outputTokens)', async () => {
      const mockStream = {
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({
          totalTokens: 100,
          inputTokens: 40,
          outputTokens: 60,
        }),
      };

      const result = await VercelProvider.getAIMetricsFromStream(mockStream);

      expect(result).toEqual({
        success: true,
        usage: {
          total: 100,
          input: 40,
          output: 60,
        },
      });
    });
  });
});
