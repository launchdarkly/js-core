import { LDContext } from '@launchdarkly/js-server-sdk-common';

import {
  LDAIAgentConfigDefault,
  LDAICompletionConfigDefault,
  LDAIJudgeConfigDefault,
} from '../src/api/config/types';
import { Judge } from '../src/api/judge/Judge';
import { AIProviderFactory } from '../src/api/providers/AIProviderFactory';
import { LDAIClientImpl } from '../src/LDAIClientImpl';
import { LDClientMin } from '../src/LDClientMin';
import { aiSdkLanguage, aiSdkName, aiSdkVersion } from '../src/sdkInfo';

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

describe('init tracking', () => {
  it('tracks init in constructor with SDK name, version, and language in data', () => {
    const client = new LDAIClientImpl(mockLdClient);
    expect(client).toBeDefined();
    expect(mockLdClient.track).toHaveBeenNthCalledWith(
      1,
      '$ld:ai:sdk:info',
      { kind: 'ld_ai', key: 'ld-internal-tracking', anonymous: true },
      { aiSdkName, aiSdkVersion, aiSdkLanguage },
      1,
    );
  });
});

describe('config evaluation', () => {
  it('evaluates completion config successfully with variable interpolation', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';
    const defaultValue: LDAICompletionConfigDefault = {
      enabled: false,
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
    const evaluateSpy = jest.spyOn(client as any, '_evaluate');
    const result = await client.completionConfig(key, testContext, defaultValue, variables);

    expect(evaluateSpy).toHaveBeenCalledWith(
      key,
      testContext,
      defaultValue,
      'completion',
      variables,
    );
    expect(result.messages).toEqual([
      { role: 'system', content: 'Hello John' },
      { role: 'user', content: 'Score: 42' },
    ]);
    expect(result.tracker).toBeDefined();
    expect(result.enabled).toBe(true);
    evaluateSpy.mockRestore();
  });

  it('includes context (ldctx) in variables for message interpolation', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';
    const defaultValue: LDAICompletionConfigDefault = {
      enabled: false,
    };

    const mockVariation = {
      messages: [{ role: 'system', content: 'User key: {{ldctx.key}}' }],
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'completion' },
    };

    mockLdClient.variation.mockResolvedValue(mockVariation);

    const result = await client.completionConfig(key, testContext, defaultValue);

    expect(result.messages?.[0].content).toBe('User key: test-user');
  });

  it('evaluates agent config successfully with instruction interpolation', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-agent';
    const defaultValue: LDAIAgentConfigDefault = {
      enabled: false,
    };

    const mockVariation = {
      model: {
        name: 'example-model',
        parameters: { temperature: 0.7, maxTokens: 4096 },
      },
      provider: {
        name: 'example-provider',
      },
      instructions:
        'You are a helpful assistant. Your name is {{name}} and your score is {{score}}',
      _ldMeta: {
        variationKey: 'v1',
        enabled: true,
        mode: 'agent',
      },
    };

    mockLdClient.variation.mockResolvedValue(mockVariation);

    const variables = { name: 'John', score: 42 };
    const evaluateSpy = jest.spyOn(client as any, '_evaluate');
    const result = await client.agentConfig(key, testContext, defaultValue, variables);

    expect(evaluateSpy).toHaveBeenCalledWith(key, testContext, defaultValue, 'agent', variables);
    expect(result.instructions).toBe(
      'You are a helpful assistant. Your name is John and your score is 42',
    );
    expect(result.tracker).toBeDefined();
    expect(result.enabled).toBe(true);
    evaluateSpy.mockRestore();
  });

  it('evaluates judge config successfully with evaluationMetricKeys (legacy)', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const defaultValue: LDAIJudgeConfigDefault = {
      enabled: false,
    };

    const mockVariation = {
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKeys: ['relevance', 'accuracy'],
      messages: [{ role: 'system', content: 'You are a judge.' }],
      _ldMeta: {
        variationKey: 'v1',
        enabled: true,
        mode: 'judge',
      },
    };

    mockLdClient.variation.mockResolvedValue(mockVariation);

    const evaluateSpy = jest.spyOn(client as any, '_evaluate');
    const result = await client.judgeConfig(key, testContext, defaultValue);

    expect(evaluateSpy).toHaveBeenCalledWith(key, testContext, defaultValue, 'judge', undefined);
    // Should use first value from evaluationMetricKeys
    expect(result.evaluationMetricKey).toBe('relevance');
    expect(result.tracker).toBeDefined();
    expect(result.enabled).toBe(true);
    evaluateSpy.mockRestore();
  });

  it('evaluates judge config successfully with evaluationMetricKey', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const defaultValue: LDAIJudgeConfigDefault = {
      enabled: false,
    };

    const mockVariation = {
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKey: 'relevance',
      messages: [{ role: 'system', content: 'You are a judge.' }],
      _ldMeta: {
        variationKey: 'v1',
        enabled: true,
        mode: 'judge',
      },
    };

    mockLdClient.variation.mockResolvedValue(mockVariation);

    const evaluateSpy = jest.spyOn(client as any, '_evaluate');
    const result = await client.judgeConfig(key, testContext, defaultValue);

    expect(evaluateSpy).toHaveBeenCalledWith(key, testContext, defaultValue, 'judge', undefined);
    expect(result.evaluationMetricKey).toBe('relevance');
    expect(result.tracker).toBeDefined();
    expect(result.enabled).toBe(true);
    evaluateSpy.mockRestore();
  });

  it('prioritizes evaluationMetricKey over evaluationMetricKeys when both are provided', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const defaultValue: LDAIJudgeConfigDefault = {
      enabled: false,
    };

    const mockVariation = {
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKey: 'helpfulness',
      evaluationMetricKeys: ['relevance', 'accuracy'],
      messages: [{ role: 'system', content: 'You are a judge.' }],
      _ldMeta: {
        variationKey: 'v1',
        enabled: true,
        mode: 'judge',
      },
    };

    mockLdClient.variation.mockResolvedValue(mockVariation);

    const evaluateSpy = jest.spyOn(client as any, '_evaluate');
    const result = await client.judgeConfig(key, testContext, defaultValue);

    expect(evaluateSpy).toHaveBeenCalledWith(key, testContext, defaultValue, 'judge', undefined);
    expect(result.evaluationMetricKey).toBe('helpfulness');
    expect(result.tracker).toBeDefined();
    expect(result.enabled).toBe(true);
    evaluateSpy.mockRestore();
  });

  it('treats empty string evaluationMetricKey as invalid and falls back to evaluationMetricKeys', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const defaultValue: LDAIJudgeConfigDefault = {
      enabled: false,
    };

    const mockVariation = {
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKey: '',
      evaluationMetricKeys: ['relevance', 'accuracy'],
      messages: [{ role: 'system', content: 'You are a judge.' }],
      _ldMeta: {
        variationKey: 'v1',
        enabled: true,
        mode: 'judge',
      },
    };

    mockLdClient.variation.mockResolvedValue(mockVariation);

    const evaluateSpy = jest.spyOn(client as any, '_evaluate');
    const result = await client.judgeConfig(key, testContext, defaultValue);

    expect(evaluateSpy).toHaveBeenCalledWith(key, testContext, defaultValue, 'judge', undefined);
    // Empty string should be treated as invalid, so should fall back to first value in evaluationMetricKeys
    expect(result.evaluationMetricKey).toBe('relevance');
    expect(result.tracker).toBeDefined();
    expect(result.enabled).toBe(true);
    evaluateSpy.mockRestore();
  });

  it('skips empty and whitespace-only strings in evaluationMetricKeys array', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const defaultValue: LDAIJudgeConfigDefault = {
      enabled: false,
    };

    const mockVariation = {
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKeys: ['', '   ', 'relevance', 'accuracy'],
      messages: [{ role: 'system', content: 'You are a judge.' }],
      _ldMeta: {
        variationKey: 'v1',
        enabled: true,
        mode: 'judge',
      },
    };

    mockLdClient.variation.mockResolvedValue(mockVariation);

    const evaluateSpy = jest.spyOn(client as any, '_evaluate');
    const result = await client.judgeConfig(key, testContext, defaultValue);

    expect(evaluateSpy).toHaveBeenCalledWith(key, testContext, defaultValue, 'judge', undefined);
    // Should skip empty and whitespace strings, use first valid value
    expect(result.evaluationMetricKey).toBe('relevance');
    expect(result.tracker).toBeDefined();
    expect(result.enabled).toBe(true);
    evaluateSpy.mockRestore();
  });

  it('handles mode mismatch by returning disabled config', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';
    const defaultValue: LDAICompletionConfigDefault = {
      enabled: false,
    };

    const mockVariation = {
      model: { name: 'example-provider', parameters: { name: 'imagination' } },
      messages: [{ role: 'system', content: 'Hello' }],
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'agent' }, // Wrong mode
    };

    mockLdClient.variation.mockResolvedValue(mockVariation);

    const result = await client.completionConfig(key, testContext, defaultValue);

    expect(result.enabled).toBe(false);
    expect(result.tracker).toBeUndefined();
  });

  it('handles missing metadata mode by defaulting to completion mode', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';
    const defaultValue: LDAICompletionConfigDefault = {
      enabled: false,
    };

    const mockVariation = {
      model: { name: 'example-provider', parameters: { name: 'imagination' } },
      messages: [{ role: 'system', content: 'Hello' }],
      // No _ldMeta - mode defaults to completion
    };

    mockLdClient.variation.mockResolvedValue(mockVariation);

    const result = await client.completionConfig(key, testContext, defaultValue);

    expect(result.enabled).toBe(false);
    expect(result.tracker).toBeDefined();
    expect(result.messages).toEqual([{ role: 'system', content: 'Hello' }]);
    expect(result.model).toEqual({ name: 'example-provider', parameters: { name: 'imagination' } });
  });

  it('uses default value when flag does not exist', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'non-existent-flag';
    const defaultValue: LDAICompletionConfigDefault = {
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

    const result = await client.completionConfig(key, testContext, defaultValue);

    expect(result.model).toEqual(defaultValue.model);
    expect(result.messages).toEqual(defaultValue.messages);
    expect(result.provider).toEqual(defaultValue.provider);
    expect(result.tracker).toBeDefined();
    expect(result.enabled).toBe(defaultValue.enabled);
    expect(mockLdClient.variation).toHaveBeenCalledWith(
      key,
      testContext,
      expect.objectContaining({
        model: defaultValue.model,
        provider: defaultValue.provider,
      }),
    );
  });
});

describe('completionConfig method', () => {
  it('calls _evaluate with correct parameters and tracks usage', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';
    const defaultValue: LDAICompletionConfigDefault = {
      model: { name: 'test', parameters: { name: 'test-model' } },
      messages: [],
      enabled: true,
    };
    const variables = { var1: 'value1' };

    const mockConfig = {
      model: { name: 'test-model' },
      messages: [],
      tracker: {} as any,
      enabled: true,
    };

    const evaluateSpy = jest.spyOn(client as any, '_evaluate');
    evaluateSpy.mockResolvedValue(mockConfig);

    const result = await client.completionConfig(key, testContext, defaultValue, variables);

    expect(mockLdClient.track).toHaveBeenCalledWith(
      '$ld:ai:usage:completion-config',
      testContext,
      key,
      1,
    );
    expect(evaluateSpy).toHaveBeenCalledWith(
      key,
      testContext,
      defaultValue,
      'completion',
      variables,
    );
    expect(result).toBeDefined();
    evaluateSpy.mockRestore();
  });
});

describe('agentConfig method', () => {
  it('calls _evaluate with correct parameters and tracks usage', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-agent';
    const defaultValue: LDAIAgentConfigDefault = {
      model: { name: 'test', parameters: { name: 'test-model' } },
      instructions: 'You are a helpful assistant.',
      enabled: true,
    };
    const variables = { var1: 'value1' };

    const mockConfig = {
      model: { name: 'test-model' },
      instructions: 'You are a helpful assistant.',
      tracker: {} as any,
      enabled: true,
    };

    const evaluateSpy = jest.spyOn(client as any, '_evaluate');
    evaluateSpy.mockResolvedValue(mockConfig);

    const result = await client.agentConfig(key, testContext, defaultValue, variables);

    expect(mockLdClient.track).toHaveBeenCalledWith(
      '$ld:ai:usage:agent-config',
      testContext,
      key,
      1,
    );
    expect(evaluateSpy).toHaveBeenCalledWith(key, testContext, defaultValue, 'agent', variables);
    expect(result).toBe(mockConfig);
    evaluateSpy.mockRestore();
  });
});

describe('agents method', () => {
  it('retrieves multiple agent configs with interpolated instructions', async () => {
    const client = new LDAIClientImpl(mockLdClient);

    const agentConfigs = [
      {
        key: 'research-agent',
        defaultValue: {
          enabled: false,
        },
        variables: { topic: 'climate change' },
      },
      {
        key: 'writing-agent',
        defaultValue: {
          enabled: false,
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

    const result = await client.agentConfigs(agentConfigs, testContext);

    expect(result).toEqual({
      'research-agent': {
        key: 'research-agent',
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
        key: 'writing-agent',
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

    expect(mockLdClient.track).toHaveBeenCalledWith(
      '$ld:ai:usage:agent-configs',
      testContext,
      agentConfigs.length,
      agentConfigs.length,
    );
  });

  it('handles empty agent configs array', async () => {
    const client = new LDAIClientImpl(mockLdClient);

    const result = await client.agentConfigs([], testContext);

    expect(result).toEqual({});

    expect(mockLdClient.track).toHaveBeenCalledWith(
      '$ld:ai:usage:agent-configs',
      testContext,
      0,
      0,
    );
  });
});

describe('judgeConfig method', () => {
  it('calls _evaluate with correct parameters and tracks usage', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const defaultValue: LDAIJudgeConfigDefault = {
      enabled: false,
    };
    const variables = { metric: 'relevance' };

    const mockJudgeConfig = {
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKeys: ['relevance'],
      messages: [{ role: 'system' as const, content: 'You are a judge for {{metric}}.' }],
      tracker: {} as any,
      toVercelAISDK: jest.fn(),
    };

    const evaluateSpy = jest.spyOn(client as any, '_evaluate');
    evaluateSpy.mockResolvedValue(mockJudgeConfig);

    const result = await client.judgeConfig(key, testContext, defaultValue, variables);

    expect(mockLdClient.track).toHaveBeenCalledWith(
      '$ld:ai:usage:judge-config',
      testContext,
      key,
      1,
    );
    expect(evaluateSpy).toHaveBeenCalledWith(key, testContext, defaultValue, 'judge', variables);
    expect(result).toBe(mockJudgeConfig);
    evaluateSpy.mockRestore();
  });
});

describe('createJudge method', () => {
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
      enabled: false,
    };

    const mockJudgeConfig = {
      key: 'test-judge',
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKeys: ['relevance', 'accuracy'],
      messages: [{ role: 'system' as const, content: 'You are a judge.' }],
      tracker: {} as any,
      toVercelAISDK: jest.fn(),
    };

    const judgeConfigSpy = jest.spyOn(client as any, '_judgeConfig');
    judgeConfigSpy.mockResolvedValue(mockJudgeConfig);

    const result = await client.createJudge(key, testContext, defaultValue);

    expect(mockLdClient.track).toHaveBeenCalledWith(
      '$ld:ai:usage:create-judge',
      testContext,
      key,
      1,
    );
    expect(judgeConfigSpy).toHaveBeenCalledWith(key, testContext, defaultValue, {
      message_history: '{{message_history}}',
      response_to_evaluate: '{{response_to_evaluate}}',
    });
    expect(AIProviderFactory.create).toHaveBeenCalledWith(mockJudgeConfig, undefined, undefined);
    expect(Judge).toHaveBeenCalledWith(
      mockJudgeConfig,
      mockJudgeConfig.tracker,
      mockProvider,
      undefined,
    );
    expect(result).toBe(mockJudge);
    judgeConfigSpy.mockRestore();
  });

  it('returns undefined when judge configuration is disabled', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const defaultValue: LDAIJudgeConfigDefault = {
      enabled: false,
    };

    const mockJudgeConfig = {
      key: 'test-judge',
      enabled: false,
      evaluationMetricKeys: [],
    };

    const judgeConfigSpy = jest.spyOn(client as any, '_judgeConfig');
    judgeConfigSpy.mockResolvedValue(mockJudgeConfig);

    const result = await client.createJudge(key, testContext, defaultValue);

    expect(result).toBeUndefined();
    expect(AIProviderFactory.create).not.toHaveBeenCalled();
    expect(Judge).not.toHaveBeenCalled();
    judgeConfigSpy.mockRestore();
  });

  it('returns undefined when AIProviderFactory.create fails', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const defaultValue: LDAIJudgeConfigDefault = {
      enabled: false,
    };

    const mockJudgeConfig = {
      key: 'test-judge',
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKeys: ['relevance'],
      messages: [{ role: 'system' as const, content: 'You are a judge.' }],
      tracker: {} as any,
      toVercelAISDK: jest.fn(),
    };

    const judgeConfigSpy = jest.spyOn(client as any, '_judgeConfig');
    judgeConfigSpy.mockResolvedValue(mockJudgeConfig);

    (AIProviderFactory.create as jest.Mock).mockResolvedValue(undefined);

    const result = await client.createJudge(key, testContext, defaultValue);

    expect(result).toBeUndefined();
    expect(AIProviderFactory.create).toHaveBeenCalledWith(mockJudgeConfig, undefined, undefined);
    expect(Judge).not.toHaveBeenCalled();
    judgeConfigSpy.mockRestore();
  });

  it('handles errors gracefully', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const defaultValue: LDAIJudgeConfigDefault = {
      enabled: false,
    };

    const error = new Error('Judge configuration error');
    const judgeConfigSpy = jest.spyOn(client as any, '_judgeConfig');
    judgeConfigSpy.mockRejectedValue(error);

    const result = await client.createJudge(key, testContext, defaultValue);

    expect(result).toBeUndefined();
    judgeConfigSpy.mockRestore();
  });
});
