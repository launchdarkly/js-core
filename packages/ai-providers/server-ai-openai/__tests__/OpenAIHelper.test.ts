import {
  convertMessagesToOpenAI,
  getAIMetricsFromResponse,
  getAIUsageFromAgentResult,
  getAIUsageFromResponse,
  getToolCallsFromRunItems,
  isAgentToolInstance,
  registryValueToAgentTool,
} from '../src/OpenAIHelper';

it('converts LDMessages to OpenAI message dicts preserving role and content', () => {
  const messages = convertMessagesToOpenAI([
    { role: 'system', content: 'You are X' },
    { role: 'user', content: 'Hi' },
    { role: 'assistant', content: 'Hello' },
  ]);

  expect(messages).toEqual([
    { role: 'system', content: 'You are X' },
    { role: 'user', content: 'Hi' },
    { role: 'assistant', content: 'Hello' },
  ]);
});

it('returns undefined when usage is missing from response', () => {
  expect(getAIUsageFromResponse({})).toBeUndefined();
});

it('maps OpenAI prompt/completion/total token fields to LDTokenUsage', () => {
  const usage = getAIUsageFromResponse({
    usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
  });

  expect(usage).toEqual({ total: 15, input: 5, output: 10 });
});

it('returns success=true with usage extracted from the response', () => {
  const metrics = getAIMetricsFromResponse({
    usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
  });

  expect(metrics).toEqual({
    success: true,
    usage: { total: 3, input: 1, output: 2 },
  });
});

it('returns undefined when runContext.usage is missing', () => {
  expect(getAIUsageFromAgentResult({ runContext: {} })).toBeUndefined();
});

it('returns undefined when all token counts are zero', () => {
  const result = {
    runContext: { usage: { totalTokens: 0, inputTokens: 0, outputTokens: 0 } },
  };
  expect(getAIUsageFromAgentResult(result)).toBeUndefined();
});

it('extracts token usage from runContext.usage', () => {
  const result = {
    runContext: { usage: { totalTokens: 30, inputTokens: 20, outputTokens: 10 } },
  };
  expect(getAIUsageFromAgentResult(result)).toEqual({ total: 30, input: 20, output: 10 });
});

it('returns undefined on malformed agent result input without throwing', () => {
  expect(getAIUsageFromAgentResult(null)).toBeUndefined();
  expect(getAIUsageFromAgentResult({})).toBeUndefined();
});

it('extracts function_call names from tool_call_items', () => {
  const items = [
    { type: 'tool_call_item', rawItem: { type: 'function_call', name: 'lookup' } },
    { type: 'tool_call_item', rawItem: { type: 'function_call', name: 'save' } },
  ];
  expect(getToolCallsFromRunItems(items)).toEqual(['lookup', 'save']);
});

it('extracts hosted_tool_call names from run items', () => {
  const items = [
    { type: 'tool_call_item', rawItem: { type: 'hosted_tool_call', name: 'web_search' } },
  ];
  expect(getToolCallsFromRunItems(items)).toEqual(['web_search']);
});

it('normalizes _call suffix to known hosted tool names', () => {
  const items = [
    { type: 'tool_call_item', rawItem: { type: 'web_search_call' } },
    { type: 'tool_call_item', rawItem: { type: 'file_search_call' } },
  ];
  expect(getToolCallsFromRunItems(items)).toEqual(['web_search', 'file_search']);
});

it('preserves unknown _call suffix types as-is', () => {
  const items = [
    { type: 'tool_call_item', rawItem: { type: 'custom_thing_call' } },
  ];
  expect(getToolCallsFromRunItems(items)).toEqual(['custom_thing_call']);
});

it('skips non tool_call_item entries', () => {
  const items = [
    { type: 'message_item', rawItem: { type: 'message', content: 'hi' } },
    { type: 'tool_call_item', rawItem: { type: 'function_call', name: 'fn' } },
  ];
  expect(getToolCallsFromRunItems(items)).toEqual(['fn']);
});

it('returns false for functions passed to isAgentToolInstance', () => {
  expect(isAgentToolInstance(() => {})).toBe(false);
});

it('returns true for non-callable objects passed to isAgentToolInstance', () => {
  expect(isAgentToolInstance({ name: 'web_search' })).toBe(true);
  expect(isAgentToolInstance('string')).toBe(true);
});

describe('given a shared fakeTool mock', () => {
  const fakeTool = jest.fn((opts: any) => ({ ...opts, wrapped: true }));

  it('passes through non-callable values without wrapping', () => {
    const hostedTool = { name: 'web_search', type: 'hosted' };
    expect(registryValueToAgentTool(hostedTool, fakeTool)).toBe(hostedTool);
    expect(fakeTool).not.toHaveBeenCalled();
  });

  it('wraps callable values using the tool helper with schema from definition', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    const definition = {
      name: 'myTool',
      description: 'Does stuff',
      parameters: { type: 'object', properties: { x: { type: 'number' } } },
    };

    const wrapped = registryValueToAgentTool(fn, fakeTool, definition);

    expect(fakeTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'myTool',
        description: 'Does stuff',
        strict: false,
      }),
    );
    expect(wrapped.wrapped).toBe(true);
  });

  it('serializes non-string tool results to JSON', async () => {
    const fn = jest.fn().mockResolvedValue({ key: 'value' });
    const definition = { name: 'test' };

    let capturedExecute: any;
    fakeTool.mockImplementation((opts: any) => {
      capturedExecute = opts.execute;
      return opts;
    });

    registryValueToAgentTool(fn, fakeTool, definition);
    const result = await capturedExecute({ arg: 1 });

    expect(fn).toHaveBeenCalledWith({ arg: 1 });
    expect(result).toBe('{"key":"value"}');
  });
});
