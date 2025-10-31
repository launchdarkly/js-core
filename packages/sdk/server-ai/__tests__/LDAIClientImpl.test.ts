import { LDContext } from '@launchdarkly/js-server-sdk-common';

import {
  LDAIAgentConfigDefault,
  LDAIConversationConfigDefault,
  LDAIJudgeConfigDefault,
} from '../src/api/config/types';
import { Judge } from '../src/api/judge/Judge';
import { AIProviderFactory } from '../src/api/providers/AIProviderFactory';
import { LDAIClientImpl } from '../src/LDAIClientImpl';
import { LDClientMin } from '../src/LDClientMin';

// Mock Judge and AIProviderFactory
jest.mock('../src/api/judge/Judge');
jest.mock('../src/api/providers/AIProviderFactory');

const mockLdClient: jest.Mocked<LDClientMin> = {
  variation: jest.fn(),
  track: jest.fn(),
};

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

const testContext: LDContext = { kind: 'user', key: 'test-user' };

it('returns config with interpolated messages', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'test-flag';
  const defaultValue: LDAIConversationConfigDefault = {
    model: { name: 'test', parameters: { name: 'test-model' } },
    messages: [],
    enabled: true,
  };

  const mockVariation = {
    model: {
      name: 'example-model',
      parameters: { name: 'imagination', temperature: 0.7, maxTokens: 4096 },
    },
    provider: {
      name: 'example-provider',
    },
    messages: [
      { role: 'system', content: 'Hello {{name}}' },
      { role: 'user', content: 'Score: {{score}}' },
    ],
    _ldMeta: {
      variationKey: 'v1',
      enabled: true,
      mode: 'completion',
    },
  };

  mockLdClient.variation.mockResolvedValue(mockVariation);

  const variables = { name: 'John', score: 42 };
  const result = await client.config(key, testContext, defaultValue, variables);

  expect(result).toEqual({
    model: {
      name: 'example-model',
      parameters: { name: 'imagination', temperature: 0.7, maxTokens: 4096 },
    },
    provider: {
      name: 'example-provider',
    },
    messages: [
      { role: 'system', content: 'Hello John' },
      { role: 'user', content: 'Score: 42' },
    ],
    tracker: expect.any(Object),
    enabled: true,
    toVercelAISDK: expect.any(Function),
  });

  // Verify tracking was called
  expect(mockLdClient.track).toHaveBeenCalledWith(
    '$ld:ai:config:function:single',
    testContext,
    key,
    1,
  );
});

it('includes context in variables for messages interpolation', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'test-flag';
  const defaultValue: LDAIConversationConfigDefault = {
    model: { name: 'test', parameters: { name: 'test-model' } },
    messages: [],
  };

  const mockVariation = {
    messages: [{ role: 'system', content: 'User key: {{ldctx.key}}' }],
    _ldMeta: { variationKey: 'v1', enabled: true, mode: 'completion' },
  };

  mockLdClient.variation.mockResolvedValue(mockVariation);

  const result = await client.config(key, testContext, defaultValue);

  expect(result.messages?.[0].content).toBe('User key: test-user');
  expect(result.toVercelAISDK).toEqual(expect.any(Function));
});

it('handles missing metadata in variation', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'test-flag';
  const defaultValue: LDAIConversationConfigDefault = {
    model: { name: 'test', parameters: { name: 'test-model' } },
    messages: [],
  };

  const mockVariation = {
    model: { name: 'example-provider', parameters: { name: 'imagination' } },
    messages: [{ role: 'system', content: 'Hello' }],
  };

  mockLdClient.variation.mockResolvedValue(mockVariation);

  const result = await client.config(key, testContext, defaultValue);

  // When metadata/mode is missing, a disabled config is returned
  expect(result).toEqual({
    enabled: false,
    tracker: undefined,
    toVercelAISDK: expect.any(Function),
  });
});

it('passes the default value to the underlying client', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'non-existent-flag';
  const defaultValue: LDAIConversationConfigDefault = {
    model: { name: 'default-model', parameters: { name: 'default' } },
    provider: { name: 'default-provider' },
    messages: [{ role: 'system', content: 'Default messages' }],
    enabled: true,
  };

  const expectedLDFlagValue = {
    _ldMeta: { enabled: true, mode: 'completion', variationKey: '' },
    model: defaultValue.model,
    messages: defaultValue.messages,
    provider: defaultValue.provider,
  };

  mockLdClient.variation.mockResolvedValue(expectedLDFlagValue);

  const result = await client.config(key, testContext, defaultValue);

  expect(result).toEqual({
    model: defaultValue.model,
    messages: defaultValue.messages,
    provider: defaultValue.provider,
    tracker: expect.any(Object),
    enabled: defaultValue.enabled,
    toVercelAISDK: expect.any(Function),
  });

  expect(mockLdClient.variation).toHaveBeenCalledWith(key, testContext, expectedLDFlagValue);
});

// New agent-related tests
it('returns single agent config with interpolated instructions', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'test-agent';
  const defaultValue: LDAIAgentConfigDefault = {
    model: { name: 'test', parameters: { name: 'test-model' } },
    instructions: 'You are a helpful assistant.',
    enabled: true,
  };

  const mockVariation = {
    model: {
      name: 'example-model',
      parameters: { name: 'imagination', temperature: 0.7, maxTokens: 4096 },
    },
    provider: {
      name: 'example-provider',
    },
    instructions: 'You are a helpful assistant. Your name is {{name}} and your score is {{score}}',
    _ldMeta: {
      variationKey: 'v1',
      enabled: true,
      mode: 'agent',
    },
  };

  mockLdClient.variation.mockResolvedValue(mockVariation);

  const variables = { name: 'John', score: 42 };
  const result = await client.agent(key, testContext, defaultValue, variables);

  expect(result).toEqual({
    model: {
      name: 'example-model',
      parameters: { name: 'imagination', temperature: 0.7, maxTokens: 4096 },
    },
    provider: {
      name: 'example-provider',
    },
    instructions: 'You are a helpful assistant. Your name is John and your score is 42',
    tracker: expect.any(Object),
    enabled: true,
  });

  // Verify tracking was called
  expect(mockLdClient.track).toHaveBeenCalledWith(
    '$ld:ai:agent:function:single',
    testContext,
    key,
    1,
  );
});

it('includes context in variables for agent instructions interpolation', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'test-agent';
  const defaultValue: LDAIAgentConfigDefault = {
    model: { name: 'test', parameters: { name: 'test-model' } },
    instructions: 'You are a helpful assistant.',
    enabled: true,
  };

  const mockVariation = {
    instructions: 'You are a helpful assistant. Your user key is {{ldctx.key}}',
    _ldMeta: { variationKey: 'v1', enabled: true, mode: 'agent' },
  };

  mockLdClient.variation.mockResolvedValue(mockVariation);

  const result = await client.agent(key, testContext, defaultValue);

  expect(result.instructions).toBe('You are a helpful assistant. Your user key is test-user');
});

it('handles missing metadata in agent variation', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'test-agent';
  const defaultValue: LDAIAgentConfigDefault = {
    model: { name: 'test', parameters: { name: 'test-model' } },
    instructions: 'You are a helpful assistant.',
    enabled: true,
  };

  const mockVariation = {
    model: { name: 'example-provider', parameters: { name: 'imagination' } },
    instructions: 'Hello.',
  };

  mockLdClient.variation.mockResolvedValue(mockVariation);

  const result = await client.agent(key, testContext, defaultValue);

  // When metadata/mode is missing, a disabled config is returned
  expect(result).toEqual({
    enabled: false,
    tracker: undefined,
  });
});

it('passes the default value to the underlying client for single agent', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'non-existent-agent';
  const defaultValue: LDAIAgentConfigDefault = {
    model: { name: 'default-model', parameters: { name: 'default' } },
    provider: { name: 'default-provider' },
    instructions: 'Default instructions',
    enabled: true,
  };

  const expectedLDFlagValue = {
    _ldMeta: { enabled: defaultValue.enabled, mode: 'agent', variationKey: '' },
    model: defaultValue.model,
    provider: defaultValue.provider,
    instructions: defaultValue.instructions,
  };

  mockLdClient.variation.mockResolvedValue(expectedLDFlagValue);

  const result = await client.agent(key, testContext, defaultValue);

  expect(result).toEqual({
    model: defaultValue.model,
    instructions: defaultValue.instructions,
    provider: defaultValue.provider,
    tracker: expect.any(Object),
    enabled: defaultValue.enabled,
  });

  expect(mockLdClient.variation).toHaveBeenCalledWith(key, testContext, expectedLDFlagValue);
});

it('returns multiple agents config with interpolated instructions', async () => {
  const client = new LDAIClientImpl(mockLdClient);

  const agentConfigs = [
    {
      key: 'research-agent',
      defaultValue: {
        model: { name: 'test', parameters: { name: 'test-model' } },
        instructions: 'You are a research assistant.',
        enabled: true,
      },
      variables: { topic: 'climate change' },
    },
    {
      key: 'writing-agent',
      defaultValue: {
        model: { name: 'test', parameters: { name: 'test-model' } },
        instructions: 'You are a writing assistant.',
        enabled: true,
      },
      variables: { style: 'academic' },
    },
  ] as const;

  const mockVariations = {
    'research-agent': {
      model: {
        name: 'research-model',
        parameters: { temperature: 0.3, maxTokens: 2048 },
      },
      provider: { name: 'openai' },
      instructions: 'You are a research assistant specializing in {{topic}}.',
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'agent' },
    },
    'writing-agent': {
      model: {
        name: 'writing-model',
        parameters: { temperature: 0.7, maxTokens: 1024 },
      },
      provider: { name: 'anthropic' },
      instructions: 'You are a writing assistant with {{style}} style.',
      _ldMeta: { variationKey: 'v2', enabled: true, mode: 'agent' },
    },
  };

  mockLdClient.variation.mockImplementation((key) =>
    Promise.resolve(mockVariations[key as keyof typeof mockVariations]),
  );

  const result = await client.agents(agentConfigs, testContext);

  expect(result).toEqual({
    'research-agent': {
      model: {
        name: 'research-model',
        parameters: { temperature: 0.3, maxTokens: 2048 },
      },
      provider: { name: 'openai' },
      instructions: 'You are a research assistant specializing in climate change.',
      tracker: expect.any(Object),
      enabled: true,
    },
    'writing-agent': {
      model: {
        name: 'writing-model',
        parameters: { temperature: 0.7, maxTokens: 1024 },
      },
      provider: { name: 'anthropic' },
      instructions: 'You are a writing assistant with academic style.',
      tracker: expect.any(Object),
      enabled: true,
    },
  });

  // Verify tracking was called
  expect(mockLdClient.track).toHaveBeenCalledWith(
    '$ld:ai:agent:function:multiple',
    testContext,
    agentConfigs.length,
    agentConfigs.length,
  );
});

it('handles empty agent configs array', async () => {
  const client = new LDAIClientImpl(mockLdClient);

  const result = await client.agents([], testContext);

  expect(result).toEqual({});

  // Verify tracking was called with 0 agents
  expect(mockLdClient.track).toHaveBeenCalledWith(
    '$ld:ai:agent:function:multiple',
    testContext,
    0,
    0,
  );
});

// New judge-related tests
describe('judge method', () => {
  it('retrieves judge configuration successfully', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const defaultValue: LDAIJudgeConfigDefault = {
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKeys: ['relevance', 'accuracy'],
      messages: [{ role: 'system', content: 'You are a judge.' }],
    };

    const mockJudgeConfig = {
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKeys: ['relevance', 'accuracy'],
      messages: [{ role: 'system' as const, content: 'You are a judge.' }],
      tracker: {} as any,
      toVercelAISDK: jest.fn(),
    };

    // Mock the _evaluate method
    const evaluateSpy = jest.spyOn(client as any, '_evaluate');
    evaluateSpy.mockResolvedValue(mockJudgeConfig);

    const result = await client.judge(key, testContext, defaultValue);

    expect(mockLdClient.track).toHaveBeenCalledWith(
      '$ld:ai:judge:function:single',
      testContext,
      key,
      1,
    );
    expect(evaluateSpy).toHaveBeenCalledWith(key, testContext, defaultValue, 'judge', undefined);
    expect(result).toBe(mockJudgeConfig);
  });

  it('handles variables parameter', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const defaultValue: LDAIJudgeConfigDefault = {
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKeys: ['relevance'],
      messages: [{ role: 'system', content: 'You are a judge.' }],
    };
    const variables = { metric: 'relevance' };

    const mockJudgeConfig = {
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKeys: ['relevance'],
      messages: [{ role: 'system' as const, content: 'You are a judge.' }],
      tracker: {} as any,
      toVercelAISDK: jest.fn(),
    };

    const evaluateSpy = jest.spyOn(client as any, '_evaluate');
    evaluateSpy.mockResolvedValue(mockJudgeConfig);

    const result = await client.judge(key, testContext, defaultValue, variables);

    expect(evaluateSpy).toHaveBeenCalledWith(key, testContext, defaultValue, 'judge', variables);
    expect(result).toBe(mockJudgeConfig);
  });
});

describe('initJudge method', () => {
  let mockProvider: jest.Mocked<any>;
  let mockJudge: jest.Mocked<Judge>;

  beforeEach(() => {
    mockProvider = {
      invokeStructuredModel: jest.fn(),
    };

    mockJudge = {
      evaluate: jest.fn(),
      evaluateMessages: jest.fn(),
    } as any;

    // Mock AIProviderFactory.create
    (AIProviderFactory.create as jest.Mock).mockResolvedValue(mockProvider);

    // Mock Judge constructor
    (Judge as jest.MockedClass<typeof Judge>).mockImplementation(() => mockJudge);
  });

  it('initializes judge successfully', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const defaultValue: LDAIJudgeConfigDefault = {
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKeys: ['relevance', 'accuracy'],
      messages: [{ role: 'system', content: 'You are a judge.' }],
    };

    const mockJudgeConfig = {
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKeys: ['relevance', 'accuracy'],
      messages: [{ role: 'system' as const, content: 'You are a judge.' }],
      tracker: {} as any,
      toVercelAISDK: jest.fn(),
    };

    // Mock the judge method
    const judgeSpy = jest.spyOn(client, 'judge');
    judgeSpy.mockResolvedValue(mockJudgeConfig);

    const result = await client.initJudge(key, testContext, defaultValue);

    expect(mockLdClient.track).toHaveBeenCalledWith(
      '$ld:ai:judge:function:initJudge',
      testContext,
      key,
      1,
    );
    expect(judgeSpy).toHaveBeenCalledWith(key, testContext, defaultValue, undefined);
    expect(AIProviderFactory.create).toHaveBeenCalledWith(mockJudgeConfig, undefined, undefined);
    expect(Judge).toHaveBeenCalledWith(
      mockJudgeConfig,
      mockJudgeConfig.tracker,
      mockProvider,
      undefined,
    );
    expect(result).toBe(mockJudge);
  });

  it('returns undefined when judge configuration is disabled', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const defaultValue: LDAIJudgeConfigDefault = {
      enabled: false,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKeys: ['relevance'],
      messages: [{ role: 'system', content: 'You are a judge.' }],
    };

    const mockJudgeConfig = {
      enabled: false, // This should be false to test disabled case
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKeys: ['relevance'],
      messages: [{ role: 'system' as const, content: 'You are a judge.' }],
      tracker: undefined, // No tracker for disabled config
      toVercelAISDK: jest.fn(),
    };

    const judgeSpy = jest.spyOn(client, 'judge');
    judgeSpy.mockResolvedValue(mockJudgeConfig);

    const result = await client.initJudge(key, testContext, defaultValue);

    expect(result).toBeUndefined();
    expect(AIProviderFactory.create).not.toHaveBeenCalled();
    expect(Judge).not.toHaveBeenCalled();
  });

  it('returns undefined when AIProviderFactory.create fails', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const defaultValue: LDAIJudgeConfigDefault = {
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKeys: ['relevance'],
      messages: [{ role: 'system', content: 'You are a judge.' }],
    };

    const mockJudgeConfig = {
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKeys: ['relevance'],
      messages: [{ role: 'system' as const, content: 'You are a judge.' }],
      tracker: {} as any,
      toVercelAISDK: jest.fn(),
    };

    const judgeSpy = jest.spyOn(client, 'judge');
    judgeSpy.mockResolvedValue(mockJudgeConfig);

    (AIProviderFactory.create as jest.Mock).mockResolvedValue(undefined);

    const result = await client.initJudge(key, testContext, defaultValue);

    expect(result).toBeUndefined();
    expect(AIProviderFactory.create).toHaveBeenCalledWith(mockJudgeConfig, undefined, undefined);
    expect(Judge).not.toHaveBeenCalled();
  });

  it('handles errors gracefully', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const defaultValue: LDAIJudgeConfigDefault = {
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKeys: ['relevance'],
      messages: [{ role: 'system', content: 'You are a judge.' }],
    };

    const error = new Error('Judge configuration error');
    const judgeSpy = jest.spyOn(client, 'judge');
    judgeSpy.mockRejectedValue(error);

    const result = await client.initJudge(key, testContext, defaultValue);

    expect(result).toBeUndefined();
  });
});
