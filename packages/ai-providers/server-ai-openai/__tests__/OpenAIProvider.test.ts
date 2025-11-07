import { OpenAI } from 'openai';

import { OpenAIProvider } from '../src/OpenAIProvider';

// Mock OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      },
    },
  })),
}));

describe('OpenAIProvider', () => {
  let mockOpenAI: jest.Mocked<OpenAI>;
  let provider: OpenAIProvider;

  beforeEach(() => {
    mockOpenAI = new OpenAI() as jest.Mocked<OpenAI>;
    provider = new OpenAIProvider(mockOpenAI, 'gpt-3.5-turbo', {});
  });

  describe('getAIMetricsFromResponse', () => {
    it('creates metrics with success=true and token usage', () => {
      const mockResponse = {
        usage: {
          prompt_tokens: 50,
          completion_tokens: 50,
          total_tokens: 100,
        },
      };

      const result = OpenAIProvider.getAIMetricsFromResponse(mockResponse);

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

      const result = OpenAIProvider.getAIMetricsFromResponse(mockResponse);

      expect(result).toEqual({
        success: true,
        usage: undefined,
      });
    });

    it('handles partial usage data', () => {
      const mockResponse = {
        usage: {
          prompt_tokens: 30,
          // completion_tokens and total_tokens missing
        },
      };

      const result = OpenAIProvider.getAIMetricsFromResponse(mockResponse);

      expect(result).toEqual({
        success: true,
        usage: {
          total: 0,
          input: 30,
          output: 0,
        },
      });
    });
  });

  describe('invokeModel', () => {
    it('invokes OpenAI chat completions and returns response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Hello! How can I help you today?',
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25,
        },
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const messages = [{ role: 'user' as const, content: 'Hello!' }];

      const result = await provider.invokeModel(messages);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
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

    it('returns unsuccessful response when no content in response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              // content is missing
            },
          },
        ],
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const messages = [{ role: 'user' as const, content: 'Hello!' }];

      const result = await provider.invokeModel(messages);

      expect(result).toEqual({
        message: {
          role: 'assistant',
          content: '',
        },
        metrics: {
          success: false,
          usage: undefined,
        },
      });
    });

    it('returns unsuccessful response when choices array is empty', async () => {
      const mockResponse = {
        choices: [],
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const messages = [{ role: 'user' as const, content: 'Hello!' }];

      const result = await provider.invokeModel(messages);

      expect(result).toEqual({
        message: {
          role: 'assistant',
          content: '',
        },
        metrics: {
          success: false,
          usage: undefined,
        },
      });
    });

    it('returns unsuccessful response when choices is undefined', async () => {
      const mockResponse = {
        // choices is missing entirely
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const messages = [{ role: 'user' as const, content: 'Hello!' }];

      const result = await provider.invokeModel(messages);

      expect(result).toEqual({
        message: {
          role: 'assistant',
          content: '',
        },
        metrics: {
          success: false,
          usage: undefined,
        },
      });
    });
  });

  describe('invokeStructuredModel', () => {
    it('invokes OpenAI with structured output and returns parsed response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '{"name": "John", "age": 30, "city": "New York"}',
            },
          },
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 10,
          total_tokens: 30,
        },
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const messages = [{ role: 'user' as const, content: 'Tell me about a person' }];
      const responseStructure = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          city: { type: 'string' },
        },
        required: ['name', 'age', 'city'],
      };

      const result = await provider.invokeStructuredModel(messages, responseStructure);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Tell me about a person' }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'structured_output',
            schema: responseStructure,
            strict: true,
          },
        },
      });

      expect(result).toEqual({
        data: {
          name: 'John',
          age: 30,
          city: 'New York',
        },
        rawResponse: '{"name": "John", "age": 30, "city": "New York"}',
        metrics: {
          success: true,
          usage: {
            total: 30,
            input: 20,
            output: 10,
          },
        },
      });
    });

    it('returns unsuccessful response when no content in structured response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              // content is missing
            },
          },
        ],
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const messages = [{ role: 'user' as const, content: 'Tell me about a person' }];
      const responseStructure = { type: 'object' };

      const result = await provider.invokeStructuredModel(messages, responseStructure);

      expect(result).toEqual({
        data: {},
        rawResponse: '',
        metrics: {
          success: false,
          usage: undefined,
        },
      });
    });

    it('handles JSON parsing errors gracefully', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'invalid json content',
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const messages = [{ role: 'user' as const, content: 'Tell me about a person' }];
      const responseStructure = { type: 'object' };

      const result = await provider.invokeStructuredModel(messages, responseStructure);

      expect(result).toEqual({
        data: {},
        rawResponse: 'invalid json content',
        metrics: {
          success: false,
          usage: {
            total: 15,
            input: 10,
            output: 5,
          },
        },
      });
    });

    it('handles empty choices array in structured response', async () => {
      const mockResponse = {
        choices: [],
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const messages = [{ role: 'user' as const, content: 'Tell me about a person' }];
      const responseStructure = { type: 'object' };

      const result = await provider.invokeStructuredModel(messages, responseStructure);

      expect(result).toEqual({
        data: {},
        rawResponse: '',
        metrics: {
          success: false,
          usage: undefined,
        },
      });
    });
  });

  describe('getClient', () => {
    it('returns the underlying OpenAI client', () => {
      const client = provider.getClient();
      expect(client).toBe(mockOpenAI);
    });
  });

  describe('create', () => {
    it('creates OpenAIProvider with correct model and parameters', async () => {
      const mockAiConfig = {
        key: 'test-config',
        model: {
          name: 'gpt-4',
          parameters: {
            temperature: 0.7,
            max_tokens: 1000,
          },
        },
        provider: { name: 'openai' },
        enabled: true,
        tracker: {} as any,
        toVercelAISDK: jest.fn(),
      };

      const result = await OpenAIProvider.create(mockAiConfig);

      expect(result).toBeInstanceOf(OpenAIProvider);
      expect(result.getClient()).toBeDefined();
    });
  });
});
