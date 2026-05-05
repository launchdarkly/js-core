import { OpenAI } from 'openai';

import type { LDAIAgentConfig } from '@launchdarkly/server-sdk-ai';

import { OpenAIAgentRunner } from '../src/OpenAIAgentRunner';

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  })),
}));

const baseAgentConfig: LDAIAgentConfig = {
  key: 'agent',
  enabled: true,
  model: { name: 'gpt-4o' },
  instructions: '',
};

describe('OpenAIAgentRunner', () => {
  let mockOpenAI: jest.Mocked<OpenAI>;

  beforeEach(() => {
    mockOpenAI = new OpenAI() as jest.Mocked<OpenAI>;
  });

  it('returns content with no toolCalls when the model does not invoke tools', async () => {
    (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue({
      choices: [{ message: { content: 'Done', tool_calls: [] } }],
      usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
    } as any);

    const runner = new OpenAIAgentRunner(mockOpenAI, baseAgentConfig, {});
    const result = await runner.run('Say done');

    expect(result.content).toBe('Done');
    expect(result.metrics.success).toBe(true);
    expect(result.metrics.toolCalls).toBeUndefined();
    expect(result.metrics.usage).toEqual({ total: 12, input: 8, output: 4 });
  });

  it('executes tools, populates toolCalls, and aggregates token usage across iterations', async () => {
    const create = mockOpenAI.chat.completions.create as jest.Mock;
    create
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  function: { name: 'lookup', arguments: '{"id":42}' },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      } as any)
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'The answer is 42.', tool_calls: [] } }],
        usage: { prompt_tokens: 6, completion_tokens: 8, total_tokens: 14 },
      } as any);

    const lookup = jest.fn().mockResolvedValue({ value: 42 });
    const toolDefinitions = [
      {
        type: 'function',
        function: { name: 'lookup', parameters: { type: 'object' } },
      },
    ];
    const config: LDAIAgentConfig = {
      key: 'agent',
      enabled: true,
      model: { name: 'gpt-4o', parameters: { tools: toolDefinitions } },
      instructions: 'You are an expert.',
    };
    const runner = new OpenAIAgentRunner(mockOpenAI, config, { lookup });

    const result = await runner.run('Look up 42');

    expect(lookup).toHaveBeenCalledWith({ id: 42 });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].tools).toBe(toolDefinitions);
    expect(create.mock.calls[0][0].messages[0]).toEqual({
      role: 'system',
      content: 'You are an expert.',
    });
    expect(result.content).toBe('The answer is 42.');
    expect(result.metrics.toolCalls).toEqual(['lookup']);
    expect(result.metrics.usage).toEqual({ total: 28, input: 16, output: 12 });
  });

  it('records the tool call and continues when a tool is missing from the registry', async () => {
    const create = mockOpenAI.chat.completions.create as jest.Mock;
    create
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [{ id: 'call_x', function: { name: 'missing', arguments: '{}' } }],
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      } as any)
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'fallback', tool_calls: [] } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      } as any);

    const runner = new OpenAIAgentRunner(mockOpenAI, baseAgentConfig, {});
    const result = await runner.run('go');

    expect(result.content).toBe('fallback');
    expect(result.metrics.toolCalls).toEqual(['missing']);
  });

  it('uses empty string when a tool returns undefined', async () => {
    const create = mockOpenAI.chat.completions.create as jest.Mock;
    create
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [{ id: 'call_1', function: { name: 'voidTool', arguments: '{}' } }],
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      } as any)
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'done', tool_calls: [] } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      } as any);

    const toolDefs = [{ type: 'function', function: { name: 'voidTool', parameters: {} } }];
    const config: LDAIAgentConfig = {
      ...baseAgentConfig,
      model: { name: 'gpt-4o', parameters: { tools: toolDefs } },
    };
    const voidTool = jest.fn().mockResolvedValue(undefined);
    const runner = new OpenAIAgentRunner(mockOpenAI, config, { voidTool });
    const result = await runner.run('go');

    const secondCallMessages = (create.mock.calls[1][0] as any).messages;
    const toolMsg = secondCallMessages.find((m: any) => m.role === 'tool');
    expect(toolMsg.content).toBe('');
    expect(result.metrics.success).toBe(true);
  });

  it('returns success=false when MAX_ITERATIONS is exhausted without a final answer', async () => {
    const create = mockOpenAI.chat.completions.create as jest.Mock;
    // Always return a tool call — the loop never gets a clean final message.
    create.mockResolvedValue({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [{ id: 'call_1', function: { name: 'loop', arguments: '{}' } }],
          },
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    } as any);

    const runner = new OpenAIAgentRunner(mockOpenAI, baseAgentConfig, { loop: jest.fn().mockResolvedValue('') });
    const result = await runner.run('spin');

    expect(result.metrics.success).toBe(false);
    expect(create).toHaveBeenCalledTimes(25);
  });

  it('returns an unsuccessful RunnerResult when the API call throws', async () => {
    (mockOpenAI.chat.completions.create as jest.Mock).mockRejectedValue(new Error('boom'));

    const runner = new OpenAIAgentRunner(mockOpenAI, baseAgentConfig, {});
    const result = await runner.run('Hi');

    expect(result.content).toBe('');
    expect(result.metrics.success).toBe(false);
  });
});
