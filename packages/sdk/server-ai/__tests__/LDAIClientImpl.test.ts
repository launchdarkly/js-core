import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDAIAgentDefaults } from '../src/api/agents';
import { LDAIDefaults } from '../src/api/config';
import { LDAIClientImpl } from '../src/LDAIClientImpl';
import { LDClientMin } from '../src/LDClientMin';

const mockLdClient: jest.Mocked<LDClientMin> = {
  variation: jest.fn(),
  track: jest.fn(),
};

const testContext: LDContext = { kind: 'user', key: 'test-user' };

beforeEach(() => {
  jest.clearAllMocks();
});

it('returns config with interpolated messagess', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'test-flag';
  const defaultValue: LDAIDefaults = {
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
  });
});

it('includes context in variables for messages interpolation', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'test-flag';
  const defaultValue: LDAIDefaults = {
    model: { name: 'test', parameters: { name: 'test-model' } },
    messages: [],
  };

  const mockVariation = {
    messages: [{ role: 'system', content: 'User key: {{ldctx.key}}' }],
    _ldMeta: { variationKey: 'v1', enabled: true },
  };

  mockLdClient.variation.mockResolvedValue(mockVariation);

  const result = await client.config(key, testContext, defaultValue);

  expect(result.messages?.[0].content).toBe('User key: test-user');
});

it('handles missing metadata in variation', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'test-flag';
  const defaultValue: LDAIDefaults = {
    model: { name: 'test', parameters: { name: 'test-model' } },
    messages: [],
  };

  const mockVariation = {
    model: { name: 'example-provider', parameters: { name: 'imagination' } },
    messages: [{ role: 'system', content: 'Hello' }],
  };

  mockLdClient.variation.mockResolvedValue(mockVariation);

  const result = await client.config(key, testContext, defaultValue);

  expect(result).toEqual({
    model: { name: 'example-provider', parameters: { name: 'imagination' } },
    messages: [{ role: 'system', content: 'Hello' }],
    tracker: expect.any(Object),
    enabled: false,
  });
});

it('passes the default value to the underlying client', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'non-existent-flag';
  const defaultValue: LDAIDefaults = {
    model: { name: 'default-model', parameters: { name: 'default' } },
    provider: { name: 'default-provider' },
    messages: [{ role: 'system', content: 'Default messages' }],
    enabled: true,
  };

  mockLdClient.variation.mockResolvedValue(defaultValue);

  const result = await client.config(key, testContext, defaultValue);

  expect(result).toEqual({
    model: defaultValue.model,
    messages: defaultValue.messages,
    provider: defaultValue.provider,
    tracker: expect.any(Object),
    enabled: false,
  });

  expect(mockLdClient.variation).toHaveBeenCalledWith(key, testContext, defaultValue);
});

it('returns single agent config with interpolated instructions', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'test-agent';
  const defaultValue: LDAIAgentDefaults = {
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
  const defaultValue: LDAIAgentDefaults = {
    model: { name: 'test', parameters: { name: 'test-model' } },
    instructions: 'You are a helpful assistant.',
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
  const defaultValue: LDAIAgentDefaults = {
    model: { name: 'test', parameters: { name: 'test-model' } },
    instructions: 'You are a helpful assistant.',
  };

  const mockVariation = {
    model: { name: 'example-provider', parameters: { name: 'imagination' } },
    instructions: 'Hello.',
  };

  mockLdClient.variation.mockResolvedValue(mockVariation);

  const result = await client.agent(key, testContext, defaultValue);

  expect(result).toEqual({
    model: { name: 'example-provider', parameters: { name: 'imagination' } },
    instructions: 'Hello.',
    tracker: expect.any(Object),
    enabled: false,
  });
});

it('passes the default value to the underlying client for single agent', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'non-existent-agent';
  const defaultValue: LDAIAgentDefaults = {
    model: { name: 'default-model', parameters: { name: 'default' } },
    provider: { name: 'default-provider' },
    instructions: 'Default instructions',
    enabled: true,
  };

  mockLdClient.variation.mockResolvedValue(defaultValue);

  const result = await client.agent(key, testContext, defaultValue);

  expect(result).toEqual({
    model: defaultValue.model,
    instructions: defaultValue.instructions,
    provider: defaultValue.provider,
    tracker: expect.any(Object),
    enabled: false,
  });

  expect(mockLdClient.variation).toHaveBeenCalledWith(key, testContext, defaultValue);
});

it('handles single agent with optional defaultValue', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'test-agent';

  const mockVariation = {
    instructions: 'You are a helpful assistant named {{name}}.',
    _ldMeta: { variationKey: 'v1', enabled: true, mode: 'agent' },
  };

  mockLdClient.variation.mockResolvedValue(mockVariation);

  const variables = { name: 'Helper' };

  // Test without providing defaultValue
  const result = await client.agent(key, testContext, undefined, variables);

  expect(result).toEqual({
    instructions: 'You are a helpful assistant named Helper.',
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

  // Verify the agent was called with { enabled: false } as default
  expect(mockLdClient.variation).toHaveBeenCalledWith(key, testContext, { enabled: false });
});

it('handles single agent without any optional parameters', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'simple-agent';

  const mockVariation = {
    instructions: 'Simple instructions.',
    _ldMeta: { variationKey: 'v1', enabled: false, mode: 'agent' },
  };

  mockLdClient.variation.mockResolvedValue(mockVariation);

  // Test with only required parameters
  const result = await client.agent(key, testContext);

  expect(result).toEqual({
    instructions: 'Simple instructions.',
    tracker: expect.any(Object),
    enabled: false,
  });

  // Verify the agent was called with { enabled: false } as default and no variables
  expect(mockLdClient.variation).toHaveBeenCalledWith(key, testContext, { enabled: false });
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

it('handles agents with optional defaultValue', async () => {
  const client = new LDAIClientImpl(mockLdClient);

  const agentConfigs = [
    {
      key: 'agent-with-default',
      defaultValue: {
        instructions: 'You are a helpful assistant.',
        enabled: true,
      },
      variables: { name: 'Assistant' },
    },
    {
      key: 'agent-without-default',
      variables: { name: 'Helper' },
      // No defaultValue provided - should default to { enabled: false }
    },
  ] as const;

  const mockVariations = {
    'agent-with-default': {
      instructions: 'Hello {{name}}!',
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'agent' },
    },
    'agent-without-default': {
      instructions: 'Hi {{name}}!',
      _ldMeta: { variationKey: 'v2', enabled: false, mode: 'agent' },
    },
  };

  mockLdClient.variation.mockImplementation((key) =>
    Promise.resolve(mockVariations[key as keyof typeof mockVariations]),
  );

  const result = await client.agents(agentConfigs, testContext);

  expect(result).toEqual({
    'agent-with-default': {
      instructions: 'Hello Assistant!',
      tracker: expect.any(Object),
      enabled: true,
    },
    'agent-without-default': {
      instructions: 'Hi Helper!',
      tracker: expect.any(Object),
      enabled: false,
    },
  });

  // Verify the agent without defaultValue was called with { enabled: false }
  expect(mockLdClient.variation).toHaveBeenCalledWith('agent-without-default', testContext, {
    enabled: false,
  });
});
