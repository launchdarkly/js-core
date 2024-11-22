import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDAIDefaults } from '../src/api/config';
import { LDAIClientImpl } from '../src/LDAIClientImpl';
import { LDClientMin } from '../src/LDClientMin';

const mockLdClient: jest.Mocked<LDClientMin> = {
  variation: jest.fn(),
  track: jest.fn(),
};

const testContext: LDContext = { kind: 'user', key: 'test-user' };

it('returns config with interpolated messagess', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'test-flag';
  const defaultValue: LDAIDefaults = {
    model: { id: 'test', parameters: { name: 'test-model' } },
    messages: [],
    enabled: true,
  };

  const mockVariation = {
    model: {
      id: 'example-model',
      parameters: { name: 'imagination', temperature: 0.7, maxTokens: 4096 },
    },
    provider: {
      id: 'example-provider',
    },
    messages: [
      { role: 'system', content: 'Hello {{name}}' },
      { role: 'user', content: 'Score: {{score}}' },
    ],
    _ldMeta: {
      versionKey: 'v1',
      enabled: true,
    },
  };

  mockLdClient.variation.mockResolvedValue(mockVariation);

  const variables = { name: 'John', score: 42 };
  const result = await client.config(key, testContext, defaultValue, variables);

  expect(result).toEqual({
    model: {
      id: 'example-model',
      parameters: { name: 'imagination', temperature: 0.7, maxTokens: 4096 },
    },
    provider: {
      id: 'example-provider',
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
    model: { id: 'test', parameters: { name: 'test-model' } },
    messages: [],
  };

  const mockVariation = {
    messages: [{ role: 'system', content: 'User key: {{ldctx.key}}' }],
    _ldMeta: { versionKey: 'v1', enabled: true },
  };

  mockLdClient.variation.mockResolvedValue(mockVariation);

  const result = await client.config(key, testContext, defaultValue);

  expect(result.messages?.[0].content).toBe('User key: test-user');
});

it('handles missing metadata in variation', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'test-flag';
  const defaultValue: LDAIDefaults = {
    model: { id: 'test', parameters: { name: 'test-model' } },
    messages: [],
  };

  const mockVariation = {
    model: { id: 'example-provider', parameters: { name: 'imagination' } },
    messages: [{ role: 'system', content: 'Hello' }],
  };

  mockLdClient.variation.mockResolvedValue(mockVariation);

  const result = await client.config(key, testContext, defaultValue);

  expect(result).toEqual({
    model: { id: 'example-provider', parameters: { name: 'imagination' } },
    messages: [{ role: 'system', content: 'Hello' }],
    tracker: expect.any(Object),
    enabled: false,
  });
});

it('passes the default value to the underlying client', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'non-existent-flag';
  const defaultValue: LDAIDefaults = {
    model: { id: 'default-model', parameters: { name: 'default' } },
    provider: { id: 'default-provider' },
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
