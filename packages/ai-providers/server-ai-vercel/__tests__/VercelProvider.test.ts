import { generateObject, generateText } from 'ai';

import { VercelProvider } from '../src/VercelProvider';

// Mock Vercel AI SDK
jest.mock('ai', () => ({
  generateText: jest.fn(),
  generateObject: jest.fn(),
}));

describe('VercelProvider', () => {
  let mockModel: any;
  let provider: VercelProvider;

  beforeEach(() => {
    mockModel = { name: 'test-model' };
    provider = new VercelProvider(mockModel, {});
  });

  describe('createAIMetrics', () => {
    it('creates metrics with success=true and token usage', () => {
      const mockResponse = {
        usage: {
          promptTokens: 50,
          completionTokens: 50,
          totalTokens: 100,
        },
      };

      const result = VercelProvider.createAIMetrics(mockResponse);

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

      const result = VercelProvider.createAIMetrics(mockResponse);

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

      const result = VercelProvider.createAIMetrics(mockResponse);

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

      const result = VercelProvider.createAIMetrics(mockResponse);

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

      const result = VercelProvider.createAIMetrics(mockResponse);

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

  describe('convertToZodSchema', () => {
    it('converts simple object structure to Zod schema', () => {
      const responseStructure = {
        name: 'string',
        age: 0,
        isActive: true,
      };

      const schema = VercelProvider.convertToZodSchema(responseStructure);

      expect(schema).toBeDefined();
      expect(typeof schema.parse).toBe('function');
    });

    it('converts nested object structure to Zod schema', () => {
      const responseStructure = {
        user: {
          name: 'string',
          age: 0,
        },
        settings: {
          theme: 'string',
          notifications: true,
        },
      };

      const schema = VercelProvider.convertToZodSchema(responseStructure);

      expect(schema).toBeDefined();
      expect(typeof schema.parse).toBe('function');
    });

    it('converts array structure to Zod schema', () => {
      const responseStructure = {
        items: ['string'],
        numbers: [0],
        booleans: [true],
      };

      const schema = VercelProvider.convertToZodSchema(responseStructure);

      expect(schema).toBeDefined();
      expect(typeof schema.parse).toBe('function');
    });

    it('handles empty array structure', () => {
      const responseStructure = {
        items: [],
      };

      const schema = VercelProvider.convertToZodSchema(responseStructure);

      expect(schema).toBeDefined();
      expect(typeof schema.parse).toBe('function');
    });

    it('handles null and undefined values', () => {
      const responseStructure = {
        nullable: null,
        undefined,
        string: 'string',
      };

      const schema = VercelProvider.convertToZodSchema(responseStructure);

      expect(schema).toBeDefined();
      expect(typeof schema.parse).toBe('function');
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
        schema: expect.any(Object), // Zod schema
      });

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
});
