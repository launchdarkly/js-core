import { AIMessage } from '@langchain/core/messages';

import type { LDAICompletionConfig, LDMessage } from '@launchdarkly/server-sdk-ai';

import { LangChainModelRunner } from '../src/LangChainModelRunner';

const mockLogger = {
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const baseConfig: LDAICompletionConfig = {
  key: 'completion',
  enabled: true,
  model: { name: 'fake' },
  createTracker: jest.fn(),
};

describe('LangChainModelRunner', () => {
  let mockLLM: any;
  let runner: LangChainModelRunner;

  beforeEach(() => {
    mockLLM = {
      invoke: jest.fn(),
      withStructuredOutput: jest.fn(),
    };
    runner = new LangChainModelRunner(mockLLM, baseConfig, mockLogger);
    jest.clearAllMocks();
  });

  it('returns a successful RunnerResult with content, metrics, and raw response', async () => {
    const response = new AIMessage('hello');
    response.usage_metadata = { total_tokens: 12, input_tokens: 7, output_tokens: 5 };
    mockLLM.invoke.mockResolvedValue(response);

    const result = await runner.run('hi');

    expect(result.content).toBe('hello');
    expect(result.metrics).toEqual({
      success: true,
      tokens: { total: 12, input: 7, output: 5 },
    });
    expect(result.raw).toBe(response);
  });

  it('prepends config messages before the user prompt', async () => {
    const response = new AIMessage('reply');
    mockLLM.invoke.mockResolvedValue(response);

    const configWithMessages: LDAICompletionConfig = {
      ...baseConfig,
      messages: [{ role: 'system', content: 'You are X' }],
    };
    const r = new LangChainModelRunner(mockLLM, configWithMessages, mockLogger);
    await r.run('hi');

    const passed = mockLLM.invoke.mock.calls[0][0];
    expect(passed).toHaveLength(2);
    expect(passed[0].content).toBe('You are X');
    expect(passed[1].content).toBe('hi');
  });

  it('uses a LDMessage[] as-is without prepending config messages', async () => {
    const response = new AIMessage('direct reply');
    mockLLM.invoke.mockResolvedValue(response);

    const configWithMessages: LDAICompletionConfig = {
      ...baseConfig,
      messages: [{ role: 'system', content: 'You are X' }],
    };
    const r = new LangChainModelRunner(mockLLM, configWithMessages, mockLogger);
    const inputMessages: LDMessage[] = [
      { role: 'user', content: 'direct question' },
    ];
    await r.run(inputMessages);

    const passed = mockLLM.invoke.mock.calls[0][0];
    expect(passed).toHaveLength(1);
    expect(passed[0].content).toBe('direct question');
  });

  it('marks success=false and warns when content is non-string (multimodal)', async () => {
    mockLLM.invoke.mockResolvedValue(new AIMessage([{ type: 'image' }] as any));

    const result = await runner.run('hi');

    expect(result.content).toBe('');
    expect(result.metrics.success).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('returns success=false when invoke throws', async () => {
    const err = new Error('boom');
    mockLLM.invoke.mockRejectedValue(err);

    const result = await runner.run('hi');

    expect(result.content).toBe('');
    expect(result.metrics.success).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith('LangChain model invocation failed:', err);
  });

  it('exposes parsed structured output via parsed', async () => {
    const data = { name: 'Ada', age: 36 };
    const invoke = jest.fn().mockResolvedValue(data);
    mockLLM.withStructuredOutput.mockReturnValue({ invoke });

    const result = await runner.run('hi', { type: 'object' });

    expect(result.parsed).toEqual(data);
    expect(result.content).toBe(JSON.stringify(data));
    expect(result.metrics.success).toBe(true);
  });

  it('returns success=false when structured invoke throws', async () => {
    const err = new Error('struct boom');
    const invoke = jest.fn().mockRejectedValue(err);
    mockLLM.withStructuredOutput.mockReturnValue({ invoke });

    const result = await runner.run('hi', { type: 'object' });

    expect(result.content).toBe('');
    expect(result.parsed).toBeUndefined();
    expect(result.metrics.success).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'LangChain structured model invocation failed:',
      err,
    );
  });

  it('returns the underlying chat model', () => {
    expect(runner.getChatModel()).toBe(mockLLM);
  });

  describe('conversation history', () => {
    it('accumulates history across successful calls', async () => {
      mockLLM.invoke
        .mockResolvedValueOnce(new AIMessage('First response'))
        .mockResolvedValueOnce(new AIMessage('Second response'));

      await runner.run('First question');
      await runner.run('Second question');

      const secondCallMessages = mockLLM.invoke.mock.calls[1][0];
      const roles = secondCallMessages.map((m: any) => m.constructor.name);
      expect(roles).toEqual(['HumanMessage', 'AIMessage', 'HumanMessage']);
      expect(secondCallMessages[0].content).toBe('First question');
      expect(secondCallMessages[1].content).toBe('First response');
      expect(secondCallMessages[2].content).toBe('Second question');
    });

    it('does not accumulate history when the call throws', async () => {
      mockLLM.invoke.mockRejectedValueOnce(new Error('Model error'));
      await runner.run('Hello');

      mockLLM.invoke.mockResolvedValueOnce(new AIMessage('Recovery'));
      await runner.run('Try again');

      const secondCallMessages = mockLLM.invoke.mock.calls[1][0];
      expect(secondCallMessages).toHaveLength(1);
      expect(secondCallMessages[0].content).toBe('Try again');
    });

    it('does not accumulate history when content is empty (multimodal)', async () => {
      mockLLM.invoke.mockResolvedValueOnce(new AIMessage([{ type: 'image' }] as any));
      await runner.run('Hello');

      mockLLM.invoke.mockResolvedValueOnce(new AIMessage('Recovery'));
      await runner.run('Try again');

      const secondCallMessages = mockLLM.invoke.mock.calls[1][0];
      expect(secondCallMessages).toHaveLength(1);
      expect(secondCallMessages[0].content).toBe('Try again');
    });

    it('keeps config messages prepended ahead of accumulated history on every call', async () => {
      const configWithMessages: LDAICompletionConfig = {
        ...baseConfig,
        messages: [{ role: 'system', content: 'You are helpful.' }],
      };
      const r = new LangChainModelRunner(mockLLM, configWithMessages, mockLogger);

      mockLLM.invoke
        .mockResolvedValueOnce(new AIMessage('Answer 1'))
        .mockResolvedValueOnce(new AIMessage('Answer 2'));

      await r.run('Q1');
      await r.run('Q2');

      const secondCallMessages = mockLLM.invoke.mock.calls[1][0];
      expect(secondCallMessages).toHaveLength(4);
      expect(secondCallMessages[0].constructor.name).toBe('SystemMessage');
      expect(secondCallMessages[0].content).toBe('You are helpful.');
      expect(secondCallMessages[1].content).toBe('Q1');
      expect(secondCallMessages[2].content).toBe('Answer 1');
      expect(secondCallMessages[3].content).toBe('Q2');
    });
  });

  describe('multiTurn=false (stateless)', () => {
    const configWithMessages: LDAICompletionConfig = {
      ...baseConfig,
      messages: [{ role: 'system', content: 'You are a judge.' }],
    };

    it('does not accumulate history across successful calls', async () => {
      const statelessRunner = new LangChainModelRunner(
        mockLLM,
        configWithMessages,
        mockLogger,
        false,
      );

      mockLLM.invoke
        .mockResolvedValueOnce(new AIMessage('First response'))
        .mockResolvedValueOnce(new AIMessage('Second response'));

      await statelessRunner.run('First question');
      await statelessRunner.run('Second question');

      const firstCallMessages = mockLLM.invoke.mock.calls[0][0];
      const secondCallMessages = mockLLM.invoke.mock.calls[1][0];
      expect(firstCallMessages).toHaveLength(2);
      expect(firstCallMessages[0].content).toBe('You are a judge.');
      expect(firstCallMessages[1].content).toBe('First question');
      expect(secondCallMessages).toHaveLength(2);
      expect(secondCallMessages[0].content).toBe('You are a judge.');
      expect(secondCallMessages[1].content).toBe('Second question');
    });

    it('keeps the internal chat history length pinned to the seeded config messages', async () => {
      const statelessRunner = new LangChainModelRunner(
        mockLLM,
        configWithMessages,
        mockLogger,
        false,
      );

      mockLLM.invoke.mockResolvedValue(new AIMessage('response'));

      await statelessRunner.run('Q1');
      await statelessRunner.run('Q2');

      // eslint-disable-next-line no-underscore-dangle
      const messages = await (statelessRunner as any)._chatHistory.getMessages();
      expect(messages).toHaveLength(1);
    });

    it('defaults to multiTurn=true when the parameter is omitted', async () => {
      const defaultRunner = new LangChainModelRunner(mockLLM, configWithMessages, mockLogger);

      mockLLM.invoke
        .mockResolvedValueOnce(new AIMessage('Answer 1'))
        .mockResolvedValueOnce(new AIMessage('Answer 2'));

      await defaultRunner.run('Q1');
      await defaultRunner.run('Q2');

      const secondCallMessages = mockLLM.invoke.mock.calls[1][0];
      expect(secondCallMessages).toHaveLength(4);
    });
  });
});
