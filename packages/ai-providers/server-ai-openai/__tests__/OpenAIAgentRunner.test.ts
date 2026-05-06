import type { LDAIAgentConfig } from '@launchdarkly/server-sdk-ai';

import { OpenAIAgentRunner } from '../src/OpenAIAgentRunner';

const mockRun = jest.fn();

function makeRunResult(overrides: Record<string, any> = {}) {
  return {
    finalOutput: overrides.finalOutput ?? '',
    newItems: overrides.newItems ?? [],
    runContext: {
      usage: overrides.usage ?? { totalTokens: 0, inputTokens: 0, outputTokens: 0 },
    },
    ...overrides,
  };
}

describe('OpenAIAgentRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns content with no toolCalls when the model does not invoke tools', async () => {
    mockRun.mockResolvedValue(
      makeRunResult({
        finalOutput: 'Done',
        usage: { totalTokens: 12, inputTokens: 8, outputTokens: 4 },
      }),
    );

    const runner = new OpenAIAgentRunner({}, mockRun, {});
    const result = await runner.run('Say done');

    expect(result.content).toBe('Done');
    expect(result.metrics.success).toBe(true);
    expect(result.metrics.toolCalls).toBeUndefined();
    expect(result.metrics.usage).toEqual({ total: 12, input: 8, output: 4 });
  });

  it('reports tool calls from newItems with LD config name mapping', async () => {
    mockRun.mockResolvedValue(
      makeRunResult({
        finalOutput: 'The answer is 42.',
        newItems: [
          {
            type: 'tool_call_item',
            rawItem: { type: 'function_call', name: 'lookup' },
            agent: { name: 'ldai-agent' },
          },
        ],
        usage: { totalTokens: 28, inputTokens: 16, outputTokens: 12 },
      }),
    );

    const runner = new OpenAIAgentRunner({}, mockRun, { lookup: 'lookup' });
    const result = await runner.run('Look up 42');

    expect(result.content).toBe('The answer is 42.');
    expect(result.metrics.toolCalls).toEqual(['lookup']);
    expect(result.metrics.usage).toEqual({ total: 28, input: 16, output: 12 });
  });

  it('returns an unsuccessful RunnerResult when the agent run throws', async () => {
    mockRun.mockRejectedValue(new Error('boom'));

    const runner = new OpenAIAgentRunner({}, mockRun, {});
    const result = await runner.run('Hi');

    expect(result.content).toBe('');
    expect(result.metrics.success).toBe(false);
  });

  it('calls run with maxTurns of 25', async () => {
    mockRun.mockResolvedValue(makeRunResult({ finalOutput: 'ok' }));

    const agent = { name: 'test-agent' };
    const runner = new OpenAIAgentRunner(agent, mockRun, {});
    await runner.run('test');

    expect(mockRun).toHaveBeenCalledWith(
      agent,
      'test',
      expect.objectContaining({ maxTurns: 25 }),
    );
  });

  it('reuses the same Agent across multiple run() calls', async () => {
    mockRun.mockResolvedValue(makeRunResult({ finalOutput: 'ok' }));

    const agent = { name: 'test-agent' };
    const runner = new OpenAIAgentRunner(agent, mockRun, {});
    await runner.run('first');
    await runner.run('second');
    await runner.run('third');

    expect(mockRun).toHaveBeenCalledTimes(3);
    expect(mockRun.mock.calls[0][0]).toBe(agent);
    expect(mockRun.mock.calls[1][0]).toBe(agent);
    expect(mockRun.mock.calls[2][0]).toBe(agent);
  });
});
