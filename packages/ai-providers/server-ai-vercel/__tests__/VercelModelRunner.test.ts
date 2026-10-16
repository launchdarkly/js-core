import { generateObject, generateText, jsonSchema } from 'ai';

import type { LDAICompletionConfig } from '@launchdarkly/server-sdk-ai';

import { VercelModelRunner } from '../src/VercelModelRunner';

jest.mock('ai', () => ({
  generateText: jest.fn(),
  generateObject: jest.fn(),
  jsonSchema: jest.fn((schema) => schema),
}));

const mockLogger = {
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const baseConfig: LDAICompletionConfig = {
  key: 'completion',
  enabled: true,
  model: { name: 'mock' },
  createTracker: jest.fn(),
};

describe('VercelModelRunner', () => {
  const fakeModel = { name: 'mock' };
  let runner: VercelModelRunner;

  beforeEach(() => {
    runner = new VercelModelRunner(fakeModel as any, baseConfig, {}, mockLogger);
    jest.clearAllMocks();
  });

  describe('run (chat completion)', () => {
    it('returns a successful RunnerResult with content, metrics, and raw response', async () => {
      const result = {
        text: 'Hi!',
        usage: { totalTokens: 12, promptTokens: 7, completionTokens: 5 },
      };
      (generateText as jest.Mock).mockResolvedValue(result);

      const out = await runner.run('hello');

      expect(generateText).toHaveBeenCalledWith({
        model: fakeModel,
        messages: [{ role: 'user', content: 'hello' }],
        experimental_telemetry: { isEnabled: true },
      });
      expect(out.content).toBe('Hi!');
      expect(out.metrics).toEqual({
        success: true,
        tokens: { total: 12, input: 7, output: 5 },
      });
      expect(out.raw).toBe(result);
    });

    it('prepends config messages before the user prompt', async () => {
      (generateText as jest.Mock).mockResolvedValue({
        text: 'reply',
        usage: { totalTokens: 1, promptTokens: 1, completionTokens: 0 },
      });

      const configWithMessages: LDAICompletionConfig = {
        ...baseConfig,
        messages: [{ role: 'system', content: 'You are X' }],
      };
      const r = new VercelModelRunner(fakeModel as any, configWithMessages, {}, mockLogger);
      await r.run('hi');

      expect(generateText).toHaveBeenCalledWith({
        model: fakeModel,
        messages: [
          { role: 'system', content: 'You are X' },
          { role: 'user', content: 'hi' },
        ],
        experimental_telemetry: { isEnabled: true },
      });
    });

    it('preserves v5 token field handling via getAIMetricsFromResponse', async () => {
      (generateText as jest.Mock).mockResolvedValue({
        text: 'ok',
        usage: { totalTokens: 100, inputTokens: 40, outputTokens: 60 },
      });

      const out = await runner.run('hello');

      expect(out.metrics.tokens).toEqual({ total: 100, input: 40, output: 60 });
    });

    it('uses a LDMessage[] directly without prepending config messages', async () => {
      (generateText as jest.Mock).mockResolvedValue({
        text: 'direct',
        usage: { totalTokens: 5, promptTokens: 2, completionTokens: 3 },
      });

      const configWithMessages: LDAICompletionConfig = {
        ...baseConfig,
        messages: [{ role: 'system', content: 'Should not appear' }],
      };
      const r = new VercelModelRunner(fakeModel as any, configWithMessages, {}, mockLogger);
      const prebuilt = [
        { role: 'system' as const, content: 'Custom system' },
        { role: 'user' as const, content: 'Direct input' },
      ];
      await r.run(prebuilt);

      expect(generateText).toHaveBeenCalledWith({
        model: fakeModel,
        messages: prebuilt,
        experimental_telemetry: { isEnabled: true },
      });
    });

    it('returns success=false when generateText throws', async () => {
      const err = new Error('boom');
      (generateText as jest.Mock).mockRejectedValue(err);

      const out = await runner.run('hello');

      expect(out.content).toBe('');
      expect(out.metrics.success).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Vercel AI model invocation failed:', err);
    });
  });

  describe('run (structured output)', () => {
    it('exposes parsed structured output via parsed', async () => {
      const obj = { name: 'Ada', age: 36 };
      (generateObject as jest.Mock).mockResolvedValue({
        object: obj,
        usage: { totalTokens: 30, promptTokens: 10, completionTokens: 20 },
      });

      const schema = { type: 'object' };
      const out = await runner.run('tell', schema);

      expect(jsonSchema).toHaveBeenCalledWith(schema);
      expect(generateObject).toHaveBeenCalledWith({
        model: fakeModel,
        messages: [{ role: 'user', content: 'tell' }],
        schema,
        experimental_telemetry: { isEnabled: true },
      });
      expect(out.parsed).toEqual(obj);
      expect(out.content).toBe(JSON.stringify(obj));
      expect(out.metrics.success).toBe(true);
    });

    it('returns success=false when generateObject throws', async () => {
      const err = new Error('struct boom');
      (generateObject as jest.Mock).mockRejectedValue(err);

      const out = await runner.run('tell', { type: 'object' });

      expect(out.content).toBe('');
      expect(out.parsed).toBeUndefined();
      expect(out.metrics.success).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Vercel AI structured model invocation failed:',
        err,
      );
    });
  });

  describe('getModel', () => {
    it('returns the underlying Vercel AI model', () => {
      expect(runner.getModel()).toBe(fakeModel);
    });
  });

  describe('conversation history', () => {
    it('accumulates history across successful calls', async () => {
      (generateText as jest.Mock)
        .mockResolvedValueOnce({
          text: 'First response',
          usage: { totalTokens: 2, promptTokens: 1, completionTokens: 1 },
        })
        .mockResolvedValueOnce({
          text: 'Second response',
          usage: { totalTokens: 2, promptTokens: 1, completionTokens: 1 },
        });

      await runner.run('First question');
      await runner.run('Second question');

      const secondCallArgs = (generateText as jest.Mock).mock.calls[1][0];
      expect(secondCallArgs.messages).toEqual([
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First response' },
        { role: 'user', content: 'Second question' },
      ]);
    });

    it('does not accumulate history when the call throws', async () => {
      (generateText as jest.Mock).mockRejectedValueOnce(new Error('boom'));
      await runner.run('Hello');

      (generateText as jest.Mock).mockResolvedValueOnce({
        text: 'Recovery',
        usage: { totalTokens: 2, promptTokens: 1, completionTokens: 1 },
      });
      await runner.run('Try again');

      const secondCallArgs = (generateText as jest.Mock).mock.calls[1][0];
      expect(secondCallArgs.messages).toEqual([{ role: 'user', content: 'Try again' }]);
    });

    it('does not accumulate history when content is empty', async () => {
      (generateText as jest.Mock).mockResolvedValueOnce({
        text: '',
        finishReason: 'error',
        usage: { totalTokens: 0, promptTokens: 0, completionTokens: 0 },
      });
      await runner.run('Hello');

      (generateText as jest.Mock).mockResolvedValueOnce({
        text: 'Recovery',
        usage: { totalTokens: 2, promptTokens: 1, completionTokens: 1 },
      });
      await runner.run('Try again');

      const secondCallArgs = (generateText as jest.Mock).mock.calls[1][0];
      expect(secondCallArgs.messages).toEqual([{ role: 'user', content: 'Try again' }]);
    });

    it('keeps config messages prepended ahead of accumulated history on every call', async () => {
      const configWithMessages: LDAICompletionConfig = {
        ...baseConfig,
        messages: [{ role: 'system', content: 'You are helpful.' }],
      };
      const r = new VercelModelRunner(fakeModel as any, configWithMessages, {}, mockLogger);

      (generateText as jest.Mock)
        .mockResolvedValueOnce({
          text: 'Answer 1',
          usage: { totalTokens: 2, promptTokens: 1, completionTokens: 1 },
        })
        .mockResolvedValueOnce({
          text: 'Answer 2',
          usage: { totalTokens: 2, promptTokens: 1, completionTokens: 1 },
        });

      await r.run('Q1');
      await r.run('Q2');

      const secondCallArgs = (generateText as jest.Mock).mock.calls[1][0];
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
      const statelessRunner = new VercelModelRunner(
        fakeModel as any,
        configWithMessages,
        {},
        mockLogger,
        false,
      );

      (generateText as jest.Mock)
        .mockResolvedValueOnce({
          text: 'First response',
          usage: { totalTokens: 2, promptTokens: 1, completionTokens: 1 },
        })
        .mockResolvedValueOnce({
          text: 'Second response',
          usage: { totalTokens: 2, promptTokens: 1, completionTokens: 1 },
        });

      await statelessRunner.run('First question');
      await statelessRunner.run('Second question');

      const firstCallArgs = (generateText as jest.Mock).mock.calls[0][0];
      const secondCallArgs = (generateText as jest.Mock).mock.calls[1][0];
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
      const statelessRunner = new VercelModelRunner(
        fakeModel as any,
        configWithMessages,
        {},
        mockLogger,
        false,
      );

      (generateText as jest.Mock).mockResolvedValue({
        text: 'response',
        usage: { totalTokens: 2, promptTokens: 1, completionTokens: 1 },
      });

      await statelessRunner.run('Q1');
      await statelessRunner.run('Q2');

      // eslint-disable-next-line no-underscore-dangle
      expect((statelessRunner as any)._history).toHaveLength(1);
    });

    it('defaults to multiTurn=true when the parameter is omitted', async () => {
      const defaultRunner = new VercelModelRunner(
        fakeModel as any,
        configWithMessages,
        {},
        mockLogger,
      );

      (generateText as jest.Mock)
        .mockResolvedValueOnce({
          text: 'Answer 1',
          usage: { totalTokens: 2, promptTokens: 1, completionTokens: 1 },
        })
        .mockResolvedValueOnce({
          text: 'Answer 2',
          usage: { totalTokens: 2, promptTokens: 1, completionTokens: 1 },
        });

      await defaultRunner.run('Q1');
      await defaultRunner.run('Q2');

      const secondCallArgs = (generateText as jest.Mock).mock.calls[1][0];
      expect(secondCallArgs.messages).toEqual([
        { role: 'system', content: 'You are a judge.' },
        { role: 'user', content: 'Q1' },
        { role: 'assistant', content: 'Answer 1' },
        { role: 'user', content: 'Q2' },
      ]);
    });
  });
});
