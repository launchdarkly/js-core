import { AIMessage } from '@langchain/core/messages';

import { LangChainModelRunner } from '../src/LangChainModelRunner';

const mockLogger = {
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('LangChainModelRunner', () => {
  let mockLLM: any;
  let runner: LangChainModelRunner;

  beforeEach(() => {
    mockLLM = {
      invoke: jest.fn(),
      withStructuredOutput: jest.fn(),
    };
    runner = new LangChainModelRunner(mockLLM, mockLogger);
    jest.clearAllMocks();
  });

  describe('run (chat completion)', () => {
    it('returns a successful RunnerResult with content, metrics, and raw response', async () => {
      const response = new AIMessage('hello');
      response.usage_metadata = { total_tokens: 12, input_tokens: 7, output_tokens: 5 };
      mockLLM.invoke.mockResolvedValue(response);

      const result = await runner.run([{ role: 'user', content: 'hi' }]);

      expect(result.content).toBe('hello');
      expect(result.metrics).toEqual({
        success: true,
        usage: { total: 12, input: 7, output: 5 },
      });
      expect(result.raw).toBe(response);
    });

    it('marks success=false and warns when content is non-string (multimodal)', async () => {
      mockLLM.invoke.mockResolvedValue(new AIMessage([{ type: 'image' }] as any));

      const result = await runner.run([{ role: 'user', content: 'hi' }]);

      expect(result.content).toBe('');
      expect(result.metrics.success).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns success=false when invoke throws', async () => {
      const err = new Error('boom');
      mockLLM.invoke.mockRejectedValue(err);

      const result = await runner.run([{ role: 'user', content: 'hi' }]);

      expect(result.content).toBe('');
      expect(result.metrics.success).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('LangChain model invocation failed:', err);
    });
  });

  describe('run (structured output)', () => {
    it('exposes parsed structured output via parsed', async () => {
      const data = { name: 'Ada', age: 36 };
      const invoke = jest.fn().mockResolvedValue(data);
      mockLLM.withStructuredOutput.mockReturnValue({ invoke });

      const result = await runner.run([{ role: 'user', content: 'hi' }], { type: 'object' });

      expect(result.parsed).toEqual(data);
      expect(result.content).toBe(JSON.stringify(data));
      expect(result.metrics.success).toBe(true);
    });

    it('returns success=false when structured invoke throws', async () => {
      const err = new Error('struct boom');
      const invoke = jest.fn().mockRejectedValue(err);
      mockLLM.withStructuredOutput.mockReturnValue({ invoke });

      const result = await runner.run([{ role: 'user', content: 'hi' }], { type: 'object' });

      expect(result.content).toBe('');
      expect(result.parsed).toBeUndefined();
      expect(result.metrics.success).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'LangChain structured model invocation failed:',
        err,
      );
    });
  });

  describe('getChatModel', () => {
    it('returns the underlying chat model', () => {
      expect(runner.getChatModel()).toBe(mockLLM);
    });
  });
});
