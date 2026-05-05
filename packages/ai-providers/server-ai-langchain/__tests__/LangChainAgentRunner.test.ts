import { AIMessage, ToolMessage } from '@langchain/core/messages';

import type { LDAIAgentConfig } from '@launchdarkly/server-sdk-ai';

import { LangChainAgentRunner } from '../src/LangChainAgentRunner';

const mockLogger = {
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const baseAgentConfig: LDAIAgentConfig = {
  key: 'agent',
  enabled: true,
  model: { name: 'fake' },
  instructions: '',
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

    const runner = new LangChainAgentRunner(llm as any, baseAgentConfig, {}, mockLogger);
    const result = await runner.run('hi');

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
    const config: LDAIAgentConfig = {
      key: 'agent',
      enabled: true,
      model: { name: 'fake', parameters: { tools: toolDefinitions } },
      instructions: 'You are an expert.',
    };
    const runner = new LangChainAgentRunner(llm as any, config, { lookup }, mockLogger);

    const result = await runner.run('Look up 42');

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

    const config: LDAIAgentConfig = {
      key: 'agent',
      enabled: true,
      model: { name: 'fake', parameters: { tools: [{ name: 'missing' }] } },
      instructions: '',
    };
    const runner = new LangChainAgentRunner(llm as any, config, {}, mockLogger);

    const result = await runner.run('hi');

    expect(result.content).toBe('fallback');
    expect(result.metrics.toolCalls).toEqual(['missing']);
  });

  it('returns success=false when MAX_ITERATIONS is exhausted without a final answer', async () => {
    const loopResponse = new AIMessage('');
    loopResponse.tool_calls = [{ id: 'call_1', name: 'loop', args: {} }];
    const llm = {
      invoke: jest.fn().mockResolvedValue(loopResponse),
      bindTools: jest.fn().mockReturnThis(),
    };

    const toolDefs = [{ type: 'function', function: { name: 'loop' } }];
    const config: LDAIAgentConfig = {
      ...baseAgentConfig,
      model: { name: 'fake', parameters: { tools: toolDefs } },
    };
    const runner = new LangChainAgentRunner(llm as any, config, { loop: jest.fn().mockResolvedValue('') }, mockLogger);
    const result = await runner.run('spin');

    expect(result.metrics.success).toBe(false);
    expect(llm.invoke).toHaveBeenCalledTimes(25);
  });

  it('returns success=false when invoke throws', async () => {
    const err = new Error('boom');
    const llm = {
      invoke: jest.fn().mockRejectedValue(err),
      bindTools: jest.fn(),
    };

    const runner = new LangChainAgentRunner(llm as any, baseAgentConfig, {}, mockLogger);
    const result = await runner.run('hi');

    expect(result.content).toBe('');
    expect(result.metrics.success).toBe(false);
  });
});
