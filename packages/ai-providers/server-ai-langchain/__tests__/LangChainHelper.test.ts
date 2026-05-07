import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { initChatModel } from 'langchain/chat_models/universal';

import {
  buildStructuredTools,
  convertMessagesToLangChain,
  createLangChainModel,
  extractLastMessageContent,
  extractToolCalls,
  getAIMetricsFromResponse,
  getAIUsageFromResponse,
  mapProviderName,
  sumTokenUsageFromMessages,
} from '../src/LangChainHelper';

jest.mock('langchain/chat_models/universal', () => ({
  initChatModel: jest.fn(),
}));

const mockInitChatModel = initChatModel as jest.MockedFunction<typeof initChatModel>;

describe('createLangChainModel', () => {
  const fakeLLM = { invoke: jest.fn() };

  beforeEach(() => {
    mockInitChatModel.mockReset();
    mockInitChatModel.mockResolvedValue(fakeLLM as any);
  });

  it('calls initChatModel with model name and mapped provider', async () => {
    await createLangChainModel({
      key: 'cfg',
      enabled: true,
      provider: { name: 'openai' },
      model: { name: 'gpt-4o', parameters: { temperature: 0.5 } },
      createTracker: jest.fn(),
    });

    expect(mockInitChatModel).toHaveBeenCalledWith('gpt-4o', {
      temperature: 0.5,
      modelProvider: 'openai',
    });
  });

  it('maps gemini to google-genai', async () => {
    await createLangChainModel({
      key: 'cfg',
      enabled: true,
      provider: { name: 'gemini' },
      model: { name: 'gemini-2.0' },
      createTracker: jest.fn(),
    });

    expect(mockInitChatModel).toHaveBeenCalledWith('gemini-2.0', {
      modelProvider: 'google-genai',
    });
  });
});

it('converts system, user, and assistant messages to LangChain instances', () => {
  const result = convertMessagesToLangChain([
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'u' },
    { role: 'assistant', content: 'a' },
  ]);

  expect(result).toHaveLength(3);
  expect(result[0]).toBeInstanceOf(SystemMessage);
  expect(result[1]).toBeInstanceOf(HumanMessage);
  expect(result[2]).toBeInstanceOf(AIMessage);
});

it('throws on an unsupported role', () => {
  expect(() => convertMessagesToLangChain([{ role: 'tool' as any, content: 'x' }])).toThrow(
    'Unsupported message role: tool',
  );
});

it('maps gemini to google-genai (case-insensitive)', () => {
  expect(mapProviderName('gemini')).toBe('google-genai');
  expect(mapProviderName('Gemini')).toBe('google-genai');
  expect(mapProviderName('GEMINI')).toBe('google-genai');
});

it('returns the provider unchanged when no mapping exists', () => {
  expect(mapProviderName('openai')).toBe('openai');
  expect(mapProviderName('anthropic')).toBe('anthropic');
});

it('returns undefined when usage_metadata is absent', () => {
  expect(getAIUsageFromResponse(new AIMessage('x'))).toBeUndefined();
});

it('maps usage_metadata to LDTokenUsage', () => {
  const message = new AIMessage('x');
  message.usage_metadata = { total_tokens: 30, input_tokens: 10, output_tokens: 20 };
  expect(getAIUsageFromResponse(message)).toEqual({ total: 30, input: 10, output: 20 });
});

it('returns success=true with usage from the response', () => {
  const message = new AIMessage('x');
  message.usage_metadata = { total_tokens: 3, input_tokens: 1, output_tokens: 2 };
  expect(getAIMetricsFromResponse(message)).toEqual({
    success: true,
    tokens: { total: 3, input: 1, output: 2 },
  });
});

describe('buildStructuredTools', () => {
  const mockLogger = { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('builds a StructuredTool from a valid tool definition', () => {
    const toolDefs = [{ name: 'lookup', description: 'looks up a value' }];
    const registry = { lookup: jest.fn().mockReturnValue('result') };

    const result = buildStructuredTools(toolDefs, registry, mockLogger);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('lookup');
    expect(result[0].description).toBe('looks up a value');
  });

  it('skips tools missing from the registry and logs a warning', () => {
    const toolDefs = [{ name: 'missing', description: 'not in registry' }];

    const result = buildStructuredTools(toolDefs, {}, mockLogger);

    expect(result).toHaveLength(0);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Tool 'missing'"),
    );
  });

  it('skips non-function built-in tools and logs a warning', () => {
    const toolDefs = [{ type: 'code_interpreter', name: 'ci' }];

    const result = buildStructuredTools(toolDefs, { ci: jest.fn() }, mockLogger);

    expect(result).toHaveLength(0);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Built-in tool 'code_interpreter'"),
    );
  });

  it('handles function-style tool definitions with nested function.name', () => {
    const toolDefs = [
      { type: 'function', function: { name: 'search', description: 'searches' } },
    ];
    const registry = { search: jest.fn() };

    const result = buildStructuredTools(toolDefs, registry, mockLogger);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('search');
  });

  it('uses a default description when none is provided', () => {
    const toolDefs = [{ name: 'mytool' }];
    const registry = { mytool: jest.fn() };

    const result = buildStructuredTools(toolDefs, registry);

    expect(result[0].description).toBe('Tool mytool');
  });
});

it('extracts tool call names from AIMessages with tool_calls', () => {
  const msg1 = new AIMessage('');
  msg1.tool_calls = [
    { id: 'c1', name: 'lookup', args: {} },
    { id: 'c2', name: 'search', args: {} },
  ];
  const msg2 = new AIMessage('done');

  expect(extractToolCalls([msg1, msg2])).toEqual(['lookup', 'search']);
});

it('returns an empty array when no tool calls are present', () => {
  expect(extractToolCalls([new AIMessage('done')])).toEqual([]);
});

it('handles empty messages for extractToolCalls', () => {
  expect(extractToolCalls([])).toEqual([]);
});

it('extracts string content from the last message', () => {
  expect(
    extractLastMessageContent([new HumanMessage('hi'), new AIMessage('hello')]),
  ).toBe('hello');
});

it('returns empty string for empty array', () => {
  expect(extractLastMessageContent([])).toBe('');
});

it('returns empty string when last message content is not a string', () => {
  const msg = new AIMessage({ content: [{ type: 'text', text: 'hi' }] });
  expect(extractLastMessageContent([msg])).toBe('');
});

it('sums usage across multiple messages', () => {
  const m1 = new AIMessage('');
  m1.usage_metadata = { total_tokens: 10, input_tokens: 6, output_tokens: 4 };
  const m2 = new AIMessage('done');
  m2.usage_metadata = { total_tokens: 8, input_tokens: 3, output_tokens: 5 };
  const toolMsg = new ToolMessage({ tool_call_id: 'x', content: 'res' });

  expect(sumTokenUsageFromMessages([m1, toolMsg, m2])).toEqual({
    total: 18,
    input: 9,
    output: 9,
  });
});

it('returns undefined when no messages have usage', () => {
  expect(sumTokenUsageFromMessages([new AIMessage('hi')])).toBeUndefined();
});
