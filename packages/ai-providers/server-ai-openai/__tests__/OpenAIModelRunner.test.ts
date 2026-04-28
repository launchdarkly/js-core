import { OpenAI } from 'openai';

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

  beforeEach(() => {
    mockOpenAI = new OpenAI() as jest.Mocked<OpenAI>;
    runner = new OpenAIModelRunner(mockOpenAI, 'gpt-3.5-turbo', {});
  });

  describe('run (chat completion)', () => {
    it('returns a RunnerResult with content, metrics, and raw response', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Hello there!' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const result = await runner.run([{ role: 'user', content: 'Hi' }]);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hi' }],
      });
      expect(result.content).toBe('Hello there!');
      expect(result.metrics).toEqual({
        success: true,
        usage: { total: 15, input: 10, output: 5 },
      });
      expect(result.raw).toBe(mockResponse);
      expect(result.parsed).toBeUndefined();
    });

    it('marks the result unsuccessful when response has no content', async () => {
      const mockResponse = { choices: [{ message: {} }] };
      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const result = await runner.run([{ role: 'user', content: 'Hi' }]);

      expect(result.content).toBe('');
      expect(result.metrics.success).toBe(false);
    });

    it('returns an unsuccessful RunnerResult when the API call throws', async () => {
      (mockOpenAI.chat.completions.create as jest.Mock).mockRejectedValue(new Error('boom'));

      const result = await runner.run([{ role: 'user', content: 'Hi' }]);

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
      const result = await runner.run(
        [{ role: 'user', content: 'Tell me about a person' }],
        schema,
      );

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

      const result = await runner.run([{ role: 'user', content: 'Hi' }], { type: 'object' });

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
});
