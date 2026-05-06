import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';

import { CompiledAgent, LangChainAgentRunner } from '../src/LangChainAgentRunner';

const mockLogger = {
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

function makeAgent(invoke: jest.Mock): CompiledAgent {
  return { invoke };
}

it('returns content with no toolCalls when the agent returns a simple response', async () => {
  const finalMsg = new AIMessage('done');
  finalMsg.usage_metadata = { total_tokens: 6, input_tokens: 4, output_tokens: 2 };

  const agent = makeAgent(jest.fn().mockResolvedValue({ messages: [finalMsg] }));
  const runner = new LangChainAgentRunner(agent, mockLogger);
  const result = await runner.run('hi');

  expect(agent.invoke).toHaveBeenCalledWith({
    messages: [{ role: 'user', content: 'hi' }],
  });
  expect(result.content).toBe('done');
  expect(result.metrics.success).toBe(true);
  expect(result.metrics.toolCalls).toBeUndefined();
  expect(result.metrics.usage).toEqual({ total: 6, input: 4, output: 2 });
});

it('extracts tool calls and aggregates usage from multi-step agent messages', async () => {
  const toolCallMsg = new AIMessage('');
  toolCallMsg.tool_calls = [{ id: 'call_1', name: 'lookup', args: { id: 42 } }];
  toolCallMsg.usage_metadata = { total_tokens: 14, input_tokens: 10, output_tokens: 4 };

  const toolResultMsg = new ToolMessage({ tool_call_id: 'call_1', content: '{"value":42}' });

  const finalMsg = new AIMessage('Answer is 42.');
  finalMsg.usage_metadata = { total_tokens: 14, input_tokens: 6, output_tokens: 8 };

  const agent = makeAgent(
    jest.fn().mockResolvedValue({
      messages: [
        new HumanMessage('Look up 42'),
        toolCallMsg,
        toolResultMsg,
        finalMsg,
      ],
    }),
  );

  const runner = new LangChainAgentRunner(agent, mockLogger);
  const result = await runner.run('Look up 42');

  expect(result.content).toBe('Answer is 42.');
  expect(result.metrics.toolCalls).toEqual(['lookup']);
  expect(result.metrics.usage).toEqual({ total: 28, input: 16, output: 12 });
});

it('returns success=false when the agent throws', async () => {
  const agent = makeAgent(jest.fn().mockRejectedValue(new Error('boom')));
  const runner = new LangChainAgentRunner(agent, mockLogger);
  const result = await runner.run('hi');

  expect(result.content).toBe('');
  expect(result.metrics.success).toBe(false);
  expect(mockLogger.warn).toHaveBeenCalled();
});

it('returns the underlying agent via getAgent()', () => {
  const agent = makeAgent(jest.fn());
  const runner = new LangChainAgentRunner(agent, mockLogger);
  expect(runner.getAgent()).toBe(agent);
});

it('handles empty messages array gracefully', async () => {
  const agent = makeAgent(jest.fn().mockResolvedValue({ messages: [] }));
  const runner = new LangChainAgentRunner(agent, mockLogger);
  const result = await runner.run('hi');

  expect(result.content).toBe('');
  expect(result.metrics.success).toBe(true);
  expect(result.metrics.toolCalls).toBeUndefined();
  expect(result.metrics.usage).toBeUndefined();
});
