import { AIMessage, ToolMessage } from '@langchain/core/messages';

import { LangChainAgentRunner } from '../src/LangChainAgentRunner';

const mockLogger = {
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('LangChainAgentRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns content with no toolCalls when the model does not invoke tools', async () => {
    const final = new AIMessage('done');
    final.usage_metadata = { total_tokens: 6, input_tokens: 4, output_tokens: 2 };
    const llm = {
      invoke: jest.fn().mockResolvedValue(final),
      bindTools: jest.fn(),
    };

    const runner = new LangChainAgentRunner(llm as any, '', [], {}, mockLogger);
    const result = await runner.run([{ role: 'user', content: 'hi' }]);

    expect(llm.bindTools).not.toHaveBeenCalled();
    expect(result.content).toBe('done');
    expect(result.metrics.success).toBe(true);
    expect(result.metrics.toolCalls).toBeUndefined();
    expect(result.metrics.usage).toEqual({ total: 6, input: 4, output: 2 });
  });

  it('binds tools, executes them, populates toolCalls, and aggregates usage', async () => {
    const toolMessage = new AIMessage('');
    toolMessage.tool_calls = [{ id: 'call_1', name: 'lookup', args: { id: 42 } }];
    toolMessage.usage_metadata = { total_tokens: 14, input_tokens: 10, output_tokens: 4 };

    const finalMessage = new AIMessage('Answer is 42.');
    finalMessage.usage_metadata = { total_tokens: 14, input_tokens: 6, output_tokens: 8 };

    const bound = {
      invoke: jest.fn().mockResolvedValueOnce(toolMessage).mockResolvedValueOnce(finalMessage),
    };
    const llm = {
      invoke: jest.fn(),
      bindTools: jest.fn().mockReturnValue(bound),
    };

    const lookup = jest.fn().mockResolvedValue({ value: 42 });
    const toolDefinitions = [{ name: 'lookup', description: 'looks up a value' }];
    const runner = new LangChainAgentRunner(
      llm as any,
      'You are an expert.',
      toolDefinitions,
      { lookup },
      mockLogger,
    );

    const result = await runner.run([{ role: 'user', content: 'Look up 42' }]);

    expect(llm.bindTools).toHaveBeenCalledWith(toolDefinitions);
    expect(lookup).toHaveBeenCalledWith({ id: 42 });
    expect(bound.invoke).toHaveBeenCalledTimes(2);
    const secondCallMessages = bound.invoke.mock.calls[1][0];
    expect(secondCallMessages[secondCallMessages.length - 1]).toBeInstanceOf(ToolMessage);
    expect(result.content).toBe('Answer is 42.');
    expect(result.metrics.toolCalls).toEqual(['lookup']);
    expect(result.metrics.usage).toEqual({ total: 28, input: 16, output: 12 });
  });

  it('records the tool call when the tool is missing from the registry', async () => {
    const toolMessage = new AIMessage('');
    toolMessage.tool_calls = [{ id: 'call_x', name: 'missing', args: {} }];
    const finalMessage = new AIMessage('fallback');

    const bound = {
      invoke: jest.fn().mockResolvedValueOnce(toolMessage).mockResolvedValueOnce(finalMessage),
    };
    const llm = {
      invoke: jest.fn(),
      bindTools: jest.fn().mockReturnValue(bound),
    };

    const runner = new LangChainAgentRunner(llm as any, '', [{ name: 'missing' }], {}, mockLogger);

    const result = await runner.run([{ role: 'user', content: 'hi' }]);

    expect(result.content).toBe('fallback');
    expect(result.metrics.toolCalls).toEqual(['missing']);
  });

  it('returns success=false when invoke throws', async () => {
    const err = new Error('boom');
    const llm = {
      invoke: jest.fn().mockRejectedValue(err),
      bindTools: jest.fn(),
    };

    const runner = new LangChainAgentRunner(llm as any, '', [], {}, mockLogger);
    const result = await runner.run([{ role: 'user', content: 'hi' }]);

    expect(result.content).toBe('');
    expect(result.metrics.success).toBe(false);
  });
});
