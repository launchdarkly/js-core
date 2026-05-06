import type { LDAIAgentConfig } from '@launchdarkly/server-sdk-ai';

import { OpenAIAgentRunner } from '../src/OpenAIAgentRunner';

const mockRun = jest.fn();
const mockTool = jest.fn();

jest.mock('@openai/agents', () => ({
  Agent: jest.fn().mockImplementation((opts: any) => opts),
  run: (...args: any[]) => mockRun(...args),
  tool: (opts: any) => mockTool(opts),
}));

const baseAgentConfig: LDAIAgentConfig = {
  key: 'agent',
  enabled: true,
  model: { name: 'gpt-4o' },
  instructions: '',
};

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
    mockTool.mockImplementation((opts: any) => opts);
  });

  it('returns content with no toolCalls when the model does not invoke tools', async () => {
    mockRun.mockResolvedValue(
      makeRunResult({
        finalOutput: 'Done',
        usage: { totalTokens: 12, inputTokens: 8, outputTokens: 4 },
      }),
    );

    const runner = new OpenAIAgentRunner(baseAgentConfig, {});
    const result = await runner.run('Say done');

    expect(result.content).toBe('Done');
    expect(result.metrics.success).toBe(true);
    expect(result.metrics.toolCalls).toBeUndefined();
    expect(result.metrics.usage).toEqual({ total: 12, input: 8, output: 4 });
  });

  it('passes instructions and model to the Agent constructor', async () => {
    const { Agent } = jest.requireMock('@openai/agents');
    mockRun.mockResolvedValue(makeRunResult({ finalOutput: 'ok' }));

    const config: LDAIAgentConfig = {
      key: 'agent',
      enabled: true,
      model: { name: 'gpt-4o' },
      instructions: 'You are an expert.',
    };
    const runner = new OpenAIAgentRunner(config, {});
    await runner.run('hello');

    expect(Agent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ldai-agent',
        model: 'gpt-4o',
        instructions: 'You are an expert.',
      }),
    );
  });

  it('reports tool calls from newItems with LD config name mapping', async () => {
    const lookup = jest.fn().mockResolvedValue({ value: 42 });
    const toolDefinitions = [
      {
        type: 'function',
        function: { name: 'lookup', description: 'Look up a value', parameters: { type: 'object' } },
      },
    ];
    const config: LDAIAgentConfig = {
      key: 'agent',
      enabled: true,
      model: { name: 'gpt-4o', parameters: { tools: toolDefinitions } },
      instructions: 'You are an expert.',
    };

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

    const runner = new OpenAIAgentRunner(config, { lookup });
    const result = await runner.run('Look up 42');

    expect(result.content).toBe('The answer is 42.');
    expect(result.metrics.toolCalls).toEqual(['lookup']);
    expect(result.metrics.usage).toEqual({ total: 28, input: 16, output: 12 });
  });

  it('skips tools not in the registry and logs a warning', async () => {
    const warnMessages: string[] = [];
    const logger = { warn: (msg: string) => warnMessages.push(msg) } as any;

    const toolDefinitions = [
      { type: 'function', function: { name: 'missing', parameters: { type: 'object' } } },
    ];
    const config: LDAIAgentConfig = {
      key: 'agent',
      enabled: true,
      model: { name: 'gpt-4o', parameters: { tools: toolDefinitions } },
      instructions: '',
    };

    mockRun.mockResolvedValue(makeRunResult({ finalOutput: 'fallback' }));

    const runner = new OpenAIAgentRunner(config, {}, logger);
    const result = await runner.run('go');

    expect(result.content).toBe('fallback');
    expect(warnMessages.some((m) => m.includes("'missing'"))).toBe(true);
  });

  it('returns an unsuccessful RunnerResult when the agent run throws', async () => {
    mockRun.mockRejectedValue(new Error('boom'));

    const runner = new OpenAIAgentRunner(baseAgentConfig, {});
    const result = await runner.run('Hi');

    expect(result.content).toBe('');
    expect(result.metrics.success).toBe(false);
  });

  it('maps model parameters to ModelSettings on the Agent', async () => {
    const { Agent } = jest.requireMock('@openai/agents');
    mockRun.mockResolvedValue(makeRunResult({ finalOutput: 'ok' }));

    const config: LDAIAgentConfig = {
      key: 'agent',
      enabled: true,
      model: {
        name: 'gpt-4o',
        parameters: { temperature: 0.7, top_p: 0.9, max_tokens: 1000 },
      },
      instructions: '',
    };
    const runner = new OpenAIAgentRunner(config, {});
    await runner.run('test');

    expect(Agent).toHaveBeenCalledWith(
      expect.objectContaining({
        modelSettings: { temperature: 0.7, topP: 0.9, maxTokens: 1000 },
      }),
    );
  });

  it('calls run with maxTurns of 25', async () => {
    mockRun.mockResolvedValue(makeRunResult({ finalOutput: 'ok' }));

    const runner = new OpenAIAgentRunner(baseAgentConfig, {});
    await runner.run('test');

    expect(mockRun).toHaveBeenCalledWith(
      expect.anything(),
      'test',
      expect.objectContaining({ maxTurns: 25 }),
    );
  });

  it('constructs the Agent only once across multiple run() calls', async () => {
    const { Agent } = jest.requireMock('@openai/agents');
    mockRun.mockResolvedValue(makeRunResult({ finalOutput: 'ok' }));

    const runner = new OpenAIAgentRunner(baseAgentConfig, {});
    await runner.run('first');
    await runner.run('second');
    await runner.run('third');

    expect(Agent).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledTimes(3);
  });

  it('passes through pre-built agent tool instances without wrapping', async () => {
    const hostedTool = { name: 'web_search', type: 'web_search_tool' };
    const toolDefinitions = [
      { type: 'function', function: { name: 'web_search' } },
    ];
    const config: LDAIAgentConfig = {
      key: 'agent',
      enabled: true,
      model: { name: 'gpt-4o', parameters: { tools: toolDefinitions } },
      instructions: '',
    };

    mockRun.mockResolvedValue(makeRunResult({ finalOutput: 'ok' }));

    const runner = new OpenAIAgentRunner(config, { web_search: hostedTool });
    await runner.run('search');

    const { Agent } = jest.requireMock('@openai/agents');
    const agentOpts = Agent.mock.calls[0][0];
    expect(agentOpts.tools).toContain(hostedTool);
    expect(mockTool).not.toHaveBeenCalled();
  });
});
