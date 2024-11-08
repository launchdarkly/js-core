import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDGenerationConfig } from '../src/api/config';
import { LDAIClientImpl } from '../src/LDAIClientImpl';
import { LDClientMin } from '../src/LDClientMin';

const mockLdClient: jest.Mocked<LDClientMin> = {
  variation: jest.fn(),
  track: jest.fn(),
};

const testContext: LDContext = { kind: 'user', key: 'test-user' };

it('interpolates template variables', () => {
  const client = new LDAIClientImpl(mockLdClient);
  const template = 'Hello {{name}}, your score is {{score}}';
  const variables = { name: 'John', score: 42 };

  const result = client.interpolateTemplate(template, variables);
  expect(result).toBe('Hello John, your score is 42');
});

it('handles empty variables in template interpolation', () => {
  const client = new LDAIClientImpl(mockLdClient);
  const template = 'Hello {{name}}';
  const variables = {};

  const result = client.interpolateTemplate(template, variables);
  expect(result).toBe('Hello ');
});

it('returns model config with interpolated prompts', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'test-flag';
  const defaultValue: LDGenerationConfig = {
    model: { modelId: 'test', name: 'test-model' },
    prompt: [],
  };

  const mockVariation = {
    model: { modelId: 'example-provider', name: 'imagination' },
    prompt: [
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
  const result = await client.modelConfig(key, testContext, defaultValue, variables);

  expect(result).toEqual({
    config: {
      model: { modelId: 'example-provider', name: 'imagination' },
      prompt: [
        { role: 'system', content: 'Hello John' },
        { role: 'user', content: 'Score: 42' },
      ],
    },
    tracker: expect.any(Object),
    enabled: true,
  });
});

it('includes context in variables for prompt interpolation', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'test-flag';
  const defaultValue: LDGenerationConfig = {
    model: { modelId: 'test', name: 'test-model' },
    prompt: [],
  };

  const mockVariation = {
    prompt: [{ role: 'system', content: 'User key: {{ldctx.key}}' }],
    _ldMeta: { versionKey: 'v1', enabled: true },
  };

  mockLdClient.variation.mockResolvedValue(mockVariation);

  const result = await client.modelConfig(key, testContext, defaultValue);

  expect(result.config.prompt?.[0].content).toBe('User key: test-user');
});

it('handles missing metadata in variation', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'test-flag';
  const defaultValue: LDGenerationConfig = {
    model: { modelId: 'test', name: 'test-model' },
    prompt: [],
  };

  const mockVariation = {
    model: { modelId: 'example-provider', name: 'imagination' },
    prompt: [{ role: 'system', content: 'Hello' }],
  };

  mockLdClient.variation.mockResolvedValue(mockVariation);

  const result = await client.modelConfig(key, testContext, defaultValue);

  expect(result).toEqual({
    config: {
      model: { modelId: 'example-provider', name: 'imagination' },
      prompt: [{ role: 'system', content: 'Hello' }],
    },
    tracker: expect.any(Object),
    enabled: false,
  });
});

it('passes the default value to the underlying client', async () => {
  const client = new LDAIClientImpl(mockLdClient);
  const key = 'non-existent-flag';
  const defaultValue: LDGenerationConfig = {
    model: { modelId: 'default-model', name: 'default' },
    prompt: [{ role: 'system', content: 'Default prompt' }],
  };

  mockLdClient.variation.mockResolvedValue(defaultValue);

  const result = await client.modelConfig(key, testContext, defaultValue);

  expect(result).toEqual({
    config: defaultValue,
    tracker: expect.any(Object),
    enabled: false,
  });

  expect(mockLdClient.variation).toHaveBeenCalledWith(key, testContext, defaultValue);
});
