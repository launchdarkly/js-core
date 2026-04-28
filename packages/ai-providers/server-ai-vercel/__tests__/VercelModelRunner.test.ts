import { generateObject, generateText, jsonSchema } from 'ai';

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

describe('VercelModelRunner', () => {
  const fakeModel = { name: 'mock' };
  let runner: VercelModelRunner;

  beforeEach(() => {
    runner = new VercelModelRunner(fakeModel as any, {}, mockLogger);
    jest.clearAllMocks();
  });

  describe('run (chat completion)', () => {
    it('returns a successful RunnerResult with content, metrics, and raw response', async () => {
      const result = {
        text: 'Hi!',
        usage: { totalTokens: 12, promptTokens: 7, completionTokens: 5 },
      };
      (generateText as jest.Mock).mockResolvedValue(result);

      const out = await runner.run([{ role: 'user', content: 'hello' }]);

      expect(generateText).toHaveBeenCalledWith({
        model: fakeModel,
        messages: [{ role: 'user', content: 'hello' }],
        experimental_telemetry: { isEnabled: true },
      });
      expect(out.content).toBe('Hi!');
      expect(out.metrics).toEqual({
        success: true,
        usage: { total: 12, input: 7, output: 5 },
      });
      expect(out.raw).toBe(result);
    });

    it('preserves v5 token field handling via getAIMetricsFromResponse', async () => {
      (generateText as jest.Mock).mockResolvedValue({
        text: 'ok',
        usage: { totalTokens: 100, inputTokens: 40, outputTokens: 60 },
      });

      const out = await runner.run([{ role: 'user', content: 'hello' }]);

      expect(out.metrics.usage).toEqual({ total: 100, input: 40, output: 60 });
    });

    it('returns success=false when generateText throws', async () => {
      const err = new Error('boom');
      (generateText as jest.Mock).mockRejectedValue(err);

      const out = await runner.run([{ role: 'user', content: 'hello' }]);

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
      const out = await runner.run([{ role: 'user', content: 'tell' }], schema);

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

      const out = await runner.run([{ role: 'user', content: 'tell' }], { type: 'object' });

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
});
