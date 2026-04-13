import { Agent, type AgentResult } from '@strands-agents/sdk';

import type { LDAIConfig } from '@launchdarkly/server-sdk-ai';

import { StrandsProvider } from '../src/StrandsProvider';

const mockLogger = {
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

type MockStrandsAgent = {
  messages: unknown[];
  systemPrompt?: string;
  invoke: jest.Mock;
};

// Mock @strands-agents/sdk (ESM-only; Jest loads this instead of node_modules)
jest.mock('@strands-agents/sdk', () => ({
  Agent: jest.fn().mockImplementation(() => ({
    messages: [],
    systemPrompt: undefined,
    invoke: jest.fn(),
  })),
  BedrockModel: jest.fn().mockImplementation(() => ({})),
  Message: jest
    .fn()
    .mockImplementation((data: { role: 'user' | 'assistant'; content: unknown[] }) => ({
      role: data.role,
      content: data.content,
    })),
  TextBlock: jest.fn().mockImplementation((text: string) => ({
    text,
  })),
}));

describe('StrandsProvider', () => {
  it('create returns a StrandsProvider instance', async () => {
    const config = {
      key: 'test-config',
      enabled: true,
    } as LDAIConfig;

    const provider = await StrandsProvider.create(config);

    expect(provider).toBeInstanceOf(StrandsProvider);
  });

  describe('invokeModel', () => {
    let mockAgent: MockStrandsAgent;
    let provider: StrandsProvider;

    const defaultInvokeResult = {
      toString: () => 'Hello! How can I help you today?',
      stopReason: 'endTurn',
      metrics: {
        accumulatedUsage: {
          inputTokens: 10,
          outputTokens: 15,
          totalTokens: 25,
        },
      },
    };

    beforeEach(() => {
      mockAgent = new Agent({}) as unknown as MockStrandsAgent;
      mockAgent.invoke.mockClear();
      mockAgent.invoke.mockResolvedValue(defaultInvokeResult);
      provider = new StrandsProvider(mockAgent as unknown as Agent, mockLogger);
      jest.clearAllMocks();
    });

    it('invokes Strands agent and returns response', async () => {
      const messages = [{ role: 'user' as const, content: 'Hello!' }];

      const result = await provider.invokeModel(messages);

      expect(mockAgent.invoke).toHaveBeenCalledTimes(1);
      const strandsMessages = mockAgent.invoke.mock.calls[0][0] as {
        role: string;
        content: { text: string }[];
      }[];
      expect(strandsMessages).toHaveLength(1);
      expect(strandsMessages[0].role).toBe('user');
      expect(strandsMessages[0].content[0].text).toBe('Hello!');
      expect(mockAgent.invoke.mock.calls[0][1]).toBeUndefined();

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
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('invokes agent with system and user messages', async () => {
      const messages = [
        { role: 'system' as const, content: 'You are helpful.' },
        { role: 'user' as const, content: 'Hello!' },
      ];

      const result = await provider.invokeModel(messages);

      expect(mockAgent.invoke).toHaveBeenCalledTimes(1);
      const strandsMessages = mockAgent.invoke.mock.calls[0][0] as { role: string }[];
      expect(strandsMessages).toHaveLength(1);
      expect(strandsMessages[0].role).toBe('user');
      expect(result.message.content).toBe('Hello! How can I help you today?');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('returns unsuccessful response when no content in response', async () => {
      mockAgent.invoke.mockResolvedValue({
        toString: () => '',
        stopReason: 'endTurn',
        metrics: undefined,
      });

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
      expect(mockLogger.warn).toHaveBeenCalledWith('Strands agent response has no text content');
    });

    it('returns unsuccessful response when agent invoke throws', async () => {
      const error = new Error('Bedrock error');
      mockAgent.invoke.mockRejectedValue(error);

      const messages = [{ role: 'user' as const, content: 'Hello!' }];

      const result = await provider.invokeModel(messages);

      expect(result).toEqual({
        message: {
          role: 'assistant',
          content: '',
        },
        metrics: {
          success: false,
        },
      });
      expect(mockLogger.warn).toHaveBeenCalledWith('Strands agent invocation failed:', error);
    });

    it('returns unsuccessful response when only system messages are provided', async () => {
      const messages = [{ role: 'system' as const, content: 'You are a bot.' }];

      const result = await provider.invokeModel(messages);

      expect(mockAgent.invoke).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: {
          role: 'assistant',
          content: '',
        },
        metrics: {
          success: false,
        },
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Strands agent invocation failed:',
        expect.any(Error),
      );
    });
  });

  describe('invokeStructuredModel', () => {
    let mockAgent: MockStrandsAgent;
    let provider: StrandsProvider;

    const structuredPerson = { name: 'John', age: 30, city: 'New York' };

    const defaultStructuredInvokeResult = {
      structuredOutput: structuredPerson,
      stopReason: 'endTurn',
      metrics: {
        accumulatedUsage: {
          inputTokens: 20,
          outputTokens: 10,
          totalTokens: 30,
        },
      },
    };

    beforeEach(() => {
      mockAgent = new Agent({}) as unknown as MockStrandsAgent;
      mockAgent.invoke.mockClear();
      mockAgent.invoke.mockResolvedValue(defaultStructuredInvokeResult);
      provider = new StrandsProvider(mockAgent as unknown as Agent, mockLogger);
      jest.clearAllMocks();
    });

    it('invokes Strands agent with structured output and returns parsed response', async () => {
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

      expect(mockAgent.invoke).toHaveBeenCalledTimes(1);
      const strandsMessages = mockAgent.invoke.mock.calls[0][0] as {
        role: string;
        content: { text: string }[];
      }[];
      expect(strandsMessages[0].content[0].text).toBe('Tell me about a person');
      expect(mockAgent.invoke.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          structuredOutputSchema: expect.anything(),
        }),
      );

      expect(result).toEqual({
        data: {
          name: 'John',
          age: 30,
          city: 'New York',
        },
        rawResponse: JSON.stringify(structuredPerson),
        metrics: {
          success: true,
          usage: {
            total: 30,
            input: 20,
            output: 10,
          },
        },
      });
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('wraps non-object structured output in data.value', async () => {
      mockAgent.invoke.mockResolvedValue({
        structuredOutput: 42,
        stopReason: 'endTurn',
      });

      const messages = [{ role: 'user' as const, content: 'Pick a number' }];
      const result = await provider.invokeStructuredModel(messages, { type: 'number' });

      expect(result.data).toEqual({ value: 42 });
      expect(result.rawResponse).toBe('42');
      expect(result.metrics.success).toBe(true);
    });

    it('returns unsuccessful response when structured output is missing', async () => {
      mockAgent.invoke.mockResolvedValue({
        structuredOutput: undefined,
        stopReason: 'endTurn',
        metrics: undefined,
      });

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
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Strands agent structured response has no structured output',
      );
    });

    it('returns success=false when structured invocation throws an error', async () => {
      const error = new Error('Structured invocation failed');
      mockAgent.invoke.mockRejectedValue(error);

      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const responseStructure = { type: 'object', properties: {} };

      const result = await provider.invokeStructuredModel(messages, responseStructure);

      expect(result.metrics.success).toBe(false);
      expect(result.data).toEqual({});
      expect(result.rawResponse).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Strands agent structured invocation failed:',
        error,
      );
    });

    it('returns unsuccessful response when only system messages are provided', async () => {
      const messages = [{ role: 'system' as const, content: 'You are a bot.' }];
      const responseStructure = { type: 'object', properties: {} };

      const result = await provider.invokeStructuredModel(messages, responseStructure);

      expect(mockAgent.invoke).not.toHaveBeenCalled();
      expect(result).toEqual({
        data: {},
        rawResponse: '',
        metrics: {
          success: false,
        },
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Strands agent structured invocation failed:',
        expect.any(Error),
      );
    });
  });

  describe('getAIMetricsFromAgentResult', () => {
    it('creates metrics with success=true and token usage', () => {
      const mockResult = {
        stopReason: 'endTurn',
        metrics: {
          accumulatedUsage: {
            inputTokens: 50,
            outputTokens: 50,
            totalTokens: 100,
          },
        },
      } as unknown as AgentResult;

      const result = StrandsProvider.getAIMetricsFromAgentResult(mockResult);

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
      const mockResult = {
        stopReason: 'endTurn',
      } as unknown as AgentResult;

      const result = StrandsProvider.getAIMetricsFromAgentResult(mockResult);

      expect(result).toEqual({
        success: true,
        usage: undefined,
      });
    });

    it('handles partial usage data', () => {
      const mockResult = {
        stopReason: 'endTurn',
        metrics: {
          accumulatedUsage: {
            inputTokens: 30,
            // outputTokens and totalTokens missing
          },
        },
      } as unknown as AgentResult;

      const result = StrandsProvider.getAIMetricsFromAgentResult(mockResult);

      expect(result).toEqual({
        success: true,
        usage: {
          total: 0,
          input: 30,
          output: 0,
        },
      });
    });

    it('sets success=false when stopReason is cancelled', () => {
      const mockResult = {
        stopReason: 'cancelled',
        metrics: {
          accumulatedUsage: {
            inputTokens: 10,
            outputTokens: 0,
            totalTokens: 10,
          },
        },
      } as unknown as AgentResult;

      const result = StrandsProvider.getAIMetricsFromAgentResult(mockResult);

      expect(result).toEqual({
        success: false,
        usage: {
          total: 10,
          input: 10,
          output: 0,
        },
      });
    });

    it('sets success=false when stopReason is modelContextWindowExceeded', () => {
      const mockResult = {
        stopReason: 'modelContextWindowExceeded',
      } as unknown as AgentResult;

      const result = StrandsProvider.getAIMetricsFromAgentResult(mockResult);

      expect(result).toEqual({
        success: false,
        usage: undefined,
      });
    });
  });
});
