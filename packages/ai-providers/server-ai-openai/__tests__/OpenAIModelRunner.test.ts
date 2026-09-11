import { OpenAI } from 'openai';

import type { LDAICompletionConfig } from '@launchdarkly/server-sdk-ai';

import { OpenAIModelRunner } from '../src/OpenAIModelRunner';

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  })),
}));

describe('OpenAIModelRunner', () => {
  let mockOpenAI: jest.Mocked<OpenAI>;
  let runner: OpenAIModelRunner;

  const baseConfig = {
    key: 'completion',
    enabled: true,
    model: { name: 'gpt-3.5-turbo' },
  } as LDAICompletionConfig;

  beforeEach(() => {
    mockOpenAI = new OpenAI() as jest.Mocked<OpenAI>;
    runner = new OpenAIModelRunner(mockOpenAI, baseConfig);
  });

  describe('run (chat completion)', () => {
    it('returns a RunnerResult with content, metrics, and raw response', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Hello there!' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const result = await runner.run('Hi');

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hi' }],
      });
      expect(result.content).toBe('Hello there!');
      expect(result.metrics).toEqual({
        success: true,
        tokens: { total: 15, input: 10, output: 5 },
      });
      expect(result.raw).toBe(mockResponse);
      expect(result.parsed).toBeUndefined();
    });

    it('prepends config messages before the user prompt', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'reply' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const configWithMessages: LDAICompletionConfig = {
        ...baseConfig,
        messages: [{ role: 'system', content: 'You are X' }],
      };
      const r = new OpenAIModelRunner(mockOpenAI, configWithMessages);
      await r.run('Hi');

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are X' },
          { role: 'user', content: 'Hi' },
        ],
      });
    });

    it('passes a LDMessage[] input directly without prepending config messages', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Evaluation result' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const messages = [
        { role: 'system' as const, content: 'You are a judge' },
        { role: 'user' as const, content: 'Rate this: hello' },
      ];
      const result = await runner.run(messages);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages,
      });
      expect(result.content).toBe('Evaluation result');
      expect(result.metrics.success).toBe(true);
    });

    it('marks the result unsuccessful when response has no content', async () => {
      const mockResponse = { choices: [{ message: {} }] };
      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const result = await runner.run('Hi');

      expect(result.content).toBe('');
      expect(result.metrics.success).toBe(false);
    });

    it('returns an unsuccessful RunnerResult when the API call throws', async () => {
      (mockOpenAI.chat.completions.create as jest.Mock).mockRejectedValue(new Error('boom'));

      const result = await runner.run('Hi');

      expect(result.content).toBe('');
      expect(result.metrics.success).toBe(false);
      expect(result.raw).toBeUndefined();
    });
  });

  describe('run (structured output)', () => {
    it('parses structured output and exposes it via parsed', async () => {
      const mockResponse = {
        choices: [{ message: { content: '{"name":"Ada","age":36}' } }],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      };
      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const schema = {
        type: 'object',
        properties: { name: { type: 'string' }, age: { type: 'number' } },
        required: ['name', 'age'],
      };
      const result = await runner.run('Tell me about a person', schema);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Tell me about a person' }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'structured_output',
            schema,
            strict: true,
          },
        },
      });
      expect(result.content).toBe('{"name":"Ada","age":36}');
      expect(result.parsed).toEqual({ name: 'Ada', age: 36 });
      expect(result.metrics.success).toBe(true);
    });

    it('marks the result unsuccessful when structured output is not valid JSON', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'not json' } }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
      };
      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const result = await runner.run('Hi', { type: 'object' });

      expect(result.content).toBe('not json');
      expect(result.parsed).toBeUndefined();
      expect(result.metrics.success).toBe(false);
    });
  });

  describe('getClient', () => {
    it('returns the underlying OpenAI client', () => {
      expect(runner.getClient()).toBe(mockOpenAI);
    });
  });

  describe('conversation history', () => {
    it('accumulates history across successful calls', async () => {
      (mockOpenAI.chat.completions.create as jest.Mock)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'First response' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        } as any)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Second response' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        } as any);

      await runner.run('First question');
      await runner.run('Second question');

      const secondCallArgs = (mockOpenAI.chat.completions.create as jest.Mock).mock.calls[1][0];
      expect(secondCallArgs.messages).toEqual([
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First response' },
        { role: 'user', content: 'Second question' },
      ]);
    });

    it('does not accumulate history when the call throws', async () => {
      (mockOpenAI.chat.completions.create as jest.Mock).mockRejectedValueOnce(new Error('boom'));
      await runner.run('Hello!');

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValueOnce({
        choices: [{ message: { content: 'Recovery' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      } as any);
      await runner.run('Try again');

      const secondCallArgs = (mockOpenAI.chat.completions.create as jest.Mock).mock.calls[1][0];
      expect(secondCallArgs.messages).toEqual([{ role: 'user', content: 'Try again' }]);
    });

    it('does not accumulate history when content is empty', async () => {
      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValueOnce({
        choices: [{ message: {} }],
      } as any);
      await runner.run('Hello!');

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValueOnce({
        choices: [{ message: { content: 'Recovery' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      } as any);
      await runner.run('Try again');

      const secondCallArgs = (mockOpenAI.chat.completions.create as jest.Mock).mock.calls[1][0];
      expect(secondCallArgs.messages).toEqual([{ role: 'user', content: 'Try again' }]);
    });

    it('keeps config messages prepended ahead of accumulated history on every call', async () => {
      const configWithMessages: LDAICompletionConfig = {
        ...baseConfig,
        messages: [{ role: 'system', content: 'You are helpful.' }],
      };
      const r = new OpenAIModelRunner(mockOpenAI, configWithMessages);

      (mockOpenAI.chat.completions.create as jest.Mock)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Answer 1' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        } as any)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Answer 2' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        } as any);

      await r.run('Q1');
      await r.run('Q2');

      const secondCallArgs = (mockOpenAI.chat.completions.create as jest.Mock).mock.calls[1][0];
      expect(secondCallArgs.messages).toEqual([
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Q1' },
        { role: 'assistant', content: 'Answer 1' },
        { role: 'user', content: 'Q2' },
      ]);
    });
  });

  describe('multiTurn=false (stateless)', () => {
    const configWithMessages: LDAICompletionConfig = {
      ...baseConfig,
      messages: [{ role: 'system', content: 'You are a judge.' }],
    };

    it('does not accumulate history across successful calls', async () => {
      const statelessRunner = new OpenAIModelRunner(
        mockOpenAI,
        configWithMessages,
        undefined,
        false,
      );

      (mockOpenAI.chat.completions.create as jest.Mock)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'First response' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        } as any)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Second response' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        } as any);

      await statelessRunner.run('First question');
      await statelessRunner.run('Second question');

      const firstCallArgs = (mockOpenAI.chat.completions.create as jest.Mock).mock.calls[0][0];
      const secondCallArgs = (mockOpenAI.chat.completions.create as jest.Mock).mock.calls[1][0];
      expect(firstCallArgs.messages).toEqual([
        { role: 'system', content: 'You are a judge.' },
        { role: 'user', content: 'First question' },
      ]);
      expect(secondCallArgs.messages).toEqual([
        { role: 'system', content: 'You are a judge.' },
        { role: 'user', content: 'Second question' },
      ]);
    });

    it('keeps the internal history length pinned to the seeded config messages', async () => {
      const statelessRunner = new OpenAIModelRunner(
        mockOpenAI,
        configWithMessages,
        undefined,
        false,
      );

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue({
        choices: [{ message: { content: 'response' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      } as any);

      await statelessRunner.run('Q1');
      await statelessRunner.run('Q2');

      // eslint-disable-next-line no-underscore-dangle
      expect((statelessRunner as any)._history).toHaveLength(1);
    });

    it('defaults to multiTurn=true when the parameter is omitted', async () => {
      const defaultRunner = new OpenAIModelRunner(mockOpenAI, configWithMessages);

      (mockOpenAI.chat.completions.create as jest.Mock)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Answer 1' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        } as any)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Answer 2' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        } as any);

      await defaultRunner.run('Q1');
      await defaultRunner.run('Q2');

      const secondCallArgs = (mockOpenAI.chat.completions.create as jest.Mock).mock.calls[1][0];
      expect(secondCallArgs.messages).toEqual([
        { role: 'system', content: 'You are a judge.' },
        { role: 'user', content: 'Q1' },
        { role: 'assistant', content: 'Answer 1' },
        { role: 'user', content: 'Q2' },
      ]);
    });
  });
});
