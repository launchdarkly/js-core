import { LDContext } from '@launchdarkly/js-server-sdk-common';

import {
  LDAIAgentConfigDefault,
  LDAICompletionConfigDefault,
  LDAIJudgeConfigDefault,
} from '../src/api/config/types';
import { Evaluator } from '../src/api/judge/Evaluator';
import { Judge } from '../src/api/judge/Judge';
import { RunnerFactory } from '../src/api/providers/RunnerFactory';
import { LDAIClientImpl } from '../src/LDAIClientImpl';
import { LDClientMin } from '../src/LDClientMin';
import { aiSdkLanguage, aiSdkName, aiSdkVersion } from '../src/sdkInfo';

// Mock Judge and RunnerFactory. Preserve the real `stripLegacyJudgeMessages`
// helper so the real `_judgeConfig` strip path can be exercised by tests.
jest.mock('../src/api/judge/Judge', () => {
  const actual = jest.requireActual('../src/api/judge/Judge');
  return {
    ...actual,
    Judge: jest.fn(),
  };
});
jest.mock('../src/api/providers/RunnerFactory');

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
      undefined,
      undefined,
    );
    expect(result.messages).toEqual([
      { role: 'system', content: 'Hello John' },
      { role: 'user', content: 'Score: 42' },
    ]);
    expect(result.createTracker).toBeDefined();
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

    expect(evaluateSpy).toHaveBeenCalledWith(
      key,
      testContext,
      defaultValue,
      'agent',
      variables,
      undefined,
      undefined,
    );
    expect(result.instructions).toBe(
      'You are a helpful assistant. Your name is John and your score is 42',
    );
    expect(result.createTracker).toBeDefined();
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

    expect(evaluateSpy).toHaveBeenCalledWith(key, testContext, defaultValue, 'judge', {
      message_history: '{{message_history}}',
      response_to_evaluate: '{{response_to_evaluate}}',
    });
    // Should use first value from evaluationMetricKeys
    expect(result.evaluationMetricKey).toBe('relevance');
    expect(result.createTracker).toBeDefined();
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

    expect(evaluateSpy).toHaveBeenCalledWith(key, testContext, defaultValue, 'judge', {
      message_history: '{{message_history}}',
      response_to_evaluate: '{{response_to_evaluate}}',
    });
    expect(result.evaluationMetricKey).toBe('relevance');
    expect(result.createTracker).toBeDefined();
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

    expect(evaluateSpy).toHaveBeenCalledWith(key, testContext, defaultValue, 'judge', {
      message_history: '{{message_history}}',
      response_to_evaluate: '{{response_to_evaluate}}',
    });
    expect(result.evaluationMetricKey).toBe('helpfulness');
    expect(result.createTracker).toBeDefined();
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

    expect(evaluateSpy).toHaveBeenCalledWith(key, testContext, defaultValue, 'judge', {
      message_history: '{{message_history}}',
      response_to_evaluate: '{{response_to_evaluate}}',
    });
    // Empty string should be treated as invalid, so should fall back to first value in evaluationMetricKeys
    expect(result.evaluationMetricKey).toBe('relevance');
    expect(result.createTracker).toBeDefined();
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

    expect(evaluateSpy).toHaveBeenCalledWith(key, testContext, defaultValue, 'judge', {
      message_history: '{{message_history}}',
      response_to_evaluate: '{{response_to_evaluate}}',
    });
    // Should skip empty and whitespace strings, use first valid value
    expect(result.evaluationMetricKey).toBe('relevance');
    expect(result.createTracker).toBeDefined();
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
    expect(result.createTracker).toBeInstanceOf(Function);
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
    expect(result.createTracker).toBeDefined();
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
    expect(result.createTracker).toBeDefined();
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
      createTracker: () => ({}) as any,
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
      undefined,
      undefined,
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
      createTracker: () => ({}) as any,
      enabled: true,
      evaluator: Evaluator.noop(),
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
    expect(evaluateSpy).toHaveBeenCalledWith(
      key,
      testContext,
      defaultValue,
      'agent',
      variables,
      undefined,
      undefined,
    );
    expect(result).toMatchObject(mockConfig);
    expect(result.evaluator).toBeInstanceOf(Evaluator);
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
        createTracker: expect.any(Function),
        evaluator: expect.any(Evaluator),
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
        createTracker: expect.any(Function),
        evaluator: expect.any(Evaluator),
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
      evaluationMetricKey: 'relevance',
      messages: [{ role: 'system' as const, content: 'You are a judge for {{metric}}.' }],
      createTracker: () => ({}) as any,
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
    expect(evaluateSpy).toHaveBeenCalledWith(key, testContext, defaultValue, 'judge', {
      ...variables,
      message_history: '{{message_history}}',
      response_to_evaluate: '{{response_to_evaluate}}',
    });
    // System messages without legacy template variables pass through unchanged.
    expect(result).toMatchObject(mockJudgeConfig);
    expect(result.messages).toEqual(mockJudgeConfig.messages);
    evaluateSpy.mockRestore();
  });

  it('strips legacy judge template messages from the returned config', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const defaultValue: LDAIJudgeConfigDefault = {
      enabled: false,
    };

    const mockJudgeConfig = {
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKey: 'relevance',
      messages: [
        { role: 'system' as const, content: 'You are a judge.' },
        { role: 'assistant' as const, content: '{{message_history}}' },
        { role: 'user' as const, content: 'Evaluate: {{response_to_evaluate}}' },
      ],
      createTracker: () => ({}) as any,
      toVercelAISDK: jest.fn(),
    };

    const evaluateSpy = jest.spyOn(client as any, '_evaluate');
    evaluateSpy.mockResolvedValue(mockJudgeConfig);

    const result = await client.judgeConfig(key, testContext, defaultValue);

    expect(result.messages).toEqual([{ role: 'system', content: 'You are a judge.' }]);
    evaluateSpy.mockRestore();
  });
});

describe('createJudge method', () => {
  let mockProvider: jest.Mocked<any>;
  let mockJudge: jest.Mocked<Judge>;

  beforeEach(() => {
    mockProvider = {
      run: jest.fn(),
    };

    mockJudge = {
      evaluate: jest.fn(),
      evaluateMessages: jest.fn(),
    } as any;

    // Mock RunnerFactory.createModel
    (RunnerFactory.createModel as jest.Mock).mockResolvedValue(mockProvider);

    // Mock Judge constructor
    (Judge as jest.MockedClass<typeof Judge>).mockImplementation(() => mockJudge);
  });

  it('initializes judge successfully', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const defaultValue: LDAIJudgeConfigDefault = {
      enabled: false,
    };

    const mockTrackerInstance = {} as any;
    const mockJudgeConfig = {
      key: 'test-judge',
      enabled: true,
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKey: 'relevance',
      messages: [{ role: 'system' as const, content: 'You are a judge.' }],
      createTracker: () => mockTrackerInstance,
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
    expect(judgeConfigSpy).toHaveBeenCalledWith(key, testContext, defaultValue, undefined);
    expect(RunnerFactory.createModel).toHaveBeenCalledWith(
      mockJudgeConfig,
      undefined,
      undefined,
      false,
    );
    expect(Judge).toHaveBeenCalledWith(mockJudgeConfig, mockProvider, 1.0, undefined);
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
    };

    const judgeConfigSpy = jest.spyOn(client as any, '_judgeConfig');
    judgeConfigSpy.mockResolvedValue(mockJudgeConfig);

    const result = await client.createJudge(key, testContext, defaultValue);

    expect(result).toBeUndefined();
    expect(RunnerFactory.createModel).not.toHaveBeenCalled();
    expect(Judge).not.toHaveBeenCalled();
    judgeConfigSpy.mockRestore();
  });

  it('returns undefined when RunnerFactory.createModel returns undefined', async () => {
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
      evaluationMetricKey: 'relevance',
      messages: [{ role: 'system' as const, content: 'You are a judge.' }],
      createTracker: () => ({}) as any,
      toVercelAISDK: jest.fn(),
    };

    const judgeConfigSpy = jest.spyOn(client as any, '_judgeConfig');
    judgeConfigSpy.mockResolvedValue(mockJudgeConfig);

    (RunnerFactory.createModel as jest.Mock).mockResolvedValue(undefined);

    const result = await client.createJudge(key, testContext, defaultValue);

    expect(result).toBeUndefined();
    expect(RunnerFactory.createModel).toHaveBeenCalledWith(
      mockJudgeConfig,
      undefined,
      undefined,
      false,
    );
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

describe('createTracker method', () => {
  it('reconstructs a tracker from a resumption token', () => {
    const client = new LDAIClientImpl(mockLdClient);

    // Build a token manually: { runId, configKey, variationKey, version }
    const payload = JSON.stringify({
      runId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      configKey: 'my-config',
      variationKey: 'v1',
      version: 3,
    });
    const token = Buffer.from(payload).toString('base64url');

    const tracker = client.createTracker(token, testContext);

    expect(tracker.getTrackData()).toMatchObject({
      runId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      configKey: 'my-config',
      variationKey: 'v1',
      version: 3,
      modelVersion: 1,
    });
    expect('modelKey' in tracker.getTrackData()).toBe(false);
  });
});

describe('modelKey and modelVersion tracking', () => {
  it('stamps modelKey and modelVersion on tracker from flag payload', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';

    mockLdClient.variation.mockResolvedValue({
      model: {
        name: 'gpt-4',
      },
      provider: { name: 'openai' },
      messages: [],
      _ldMeta: {
        variationKey: 'v1',
        enabled: true,
        mode: 'completion',
        version: 7,
        modelKey: 'my-model',
        modelVersion: 2,
      },
    });

    const result = await client.completionConfig(key, testContext);
    const tracker = result.createTracker();

    expect(tracker.getTrackData()).toMatchObject({
      modelKey: 'my-model',
      modelVersion: 2,
    });
  });

  it('defaults modelVersion to 1 and omits modelKey when absent from flag payload', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';

    mockLdClient.variation.mockResolvedValue({
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      messages: [],
      _ldMeta: {
        variationKey: 'v1',
        enabled: true,
        mode: 'completion',
        version: 7,
      },
    });

    const result = await client.completionConfig(key, testContext);
    const tracker = result.createTracker();

    const trackData = tracker.getTrackData();
    expect('modelKey' in trackData).toBe(false);
    expect(trackData.modelVersion).toBe(1);
  });

  it('does not expose modelKey or modelVersion on config.model', async () => {
    // modelKey/modelVersion are intentionally not exposed on LDModelConfig (they'd read as
    // properties of the LLM itself, e.g. a version like "5.4"); the only place they surface is
    // the tracker's stamped event data, mirroring variationKey/version.
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';

    mockLdClient.variation.mockResolvedValue({
      model: {
        name: 'gpt-4',
      },
      provider: { name: 'openai' },
      messages: [],
      _ldMeta: {
        variationKey: 'v1',
        enabled: true,
        mode: 'completion',
        modelKey: 'my-model',
        modelVersion: 2,
      },
    });

    const result = await client.completionConfig(key, testContext);

    expect(result.model).toEqual({
      name: 'gpt-4',
    });
  });
});

describe('optional default values', () => {
  it('uses a disabled completion config when no default is provided', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';
    const disabledFlagValue = {
      _ldMeta: { variationKey: '', enabled: false, version: 1, mode: 'completion' },
    };
    mockLdClient.variation.mockResolvedValue(disabledFlagValue);

    const result = await client.completionConfig(key, testContext);

    expect(mockLdClient.variation).toHaveBeenCalledWith(
      key,
      testContext,
      expect.objectContaining({ _ldMeta: expect.objectContaining({ enabled: false }) }),
    );
    expect(result.enabled).toBe(false);
  });

  it('uses a disabled agent config when no default is provided', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-agent';
    const disabledFlagValue = {
      _ldMeta: { variationKey: '', enabled: false, version: 1, mode: 'agent' },
      instructions: '',
    };
    mockLdClient.variation.mockResolvedValue(disabledFlagValue);

    const result = await client.agentConfig(key, testContext);

    expect(mockLdClient.variation).toHaveBeenCalledWith(
      key,
      testContext,
      expect.objectContaining({ _ldMeta: expect.objectContaining({ enabled: false }) }),
    );
    expect(result.enabled).toBe(false);
  });

  it('uses a disabled judge config when no default is provided', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const disabledFlagValue = {
      _ldMeta: { variationKey: '', enabled: false, version: 1, mode: 'judge' },
      messages: [],
      evaluationMetricKeys: [],
    };
    mockLdClient.variation.mockResolvedValue(disabledFlagValue);

    const result = await client.judgeConfig(key, testContext);

    expect(mockLdClient.variation).toHaveBeenCalledWith(
      key,
      testContext,
      expect.objectContaining({ _ldMeta: expect.objectContaining({ enabled: false }) }),
    );
    expect(result.enabled).toBe(false);
  });
});

describe('tools map support', () => {
  it('includes tools map in completion config from flag variation', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';
    const defaultValue: LDAICompletionConfigDefault = { enabled: false };
    const mockVariation = {
      model: { name: 'example-model' },
      tools: {
        'web-search-tool': {
          name: 'web-search-tool',
          type: 'function',
          parameters: { type: 'object', properties: {}, required: [] },
          customParameters: { 'some-custom-parameter': 'some-custom-value' },
        },
      },
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'completion' },
    };
    mockLdClient.variation.mockResolvedValue(mockVariation);

    const result = await client.completionConfig(key, testContext, defaultValue);

    expect(result.tools).toEqual(mockVariation.tools);
  });

  it('includes tools map in agent config from flag variation', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-agent';
    const defaultValue: LDAIAgentConfigDefault = { enabled: false };
    const mockVariation = {
      model: { name: 'example-model' },
      instructions: 'You are a helpful agent.',
      tools: {
        'search-tool': {
          name: 'search-tool',
          type: 'function',
          customParameters: { maxResults: 10 },
        },
      },
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'agent' },
    };
    mockLdClient.variation.mockResolvedValue(mockVariation);

    const result = await client.agentConfig(key, testContext, defaultValue);

    expect(result.tools).toEqual(mockVariation.tools);
  });

  it('returns undefined tools when variation has no tools', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';
    const defaultTools = {
      'default-tool': {
        name: 'default-tool',
        type: 'function',
        customParameters: { priority: 'high' },
      },
    };
    const defaultValue: LDAICompletionConfigDefault = { enabled: true, tools: defaultTools };
    mockLdClient.variation.mockResolvedValue({
      _ldMeta: { enabled: true, mode: 'completion', variationKey: '' },
    });

    const result = await client.completionConfig(key, testContext, defaultValue);

    expect(result.tools).toBeUndefined();
  });

  it('returns undefined tools when no tools are configured', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';
    const defaultValue: LDAICompletionConfigDefault = { enabled: false };
    const mockVariation = {
      model: { name: 'example-model' },
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'completion' },
    };
    mockLdClient.variation.mockResolvedValue(mockVariation);

    const result = await client.completionConfig(key, testContext, defaultValue);

    expect(result.tools).toBeUndefined();
  });

  it('converts model.parameters.tools array to map when root tools is absent', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';
    const defaultValue: LDAICompletionConfigDefault = { enabled: false };
    const mockVariation = {
      model: {
        name: 'example-model',
        parameters: {
          tools: [
            {
              name: 'search',
              type: 'function',
              description: 'Search the web',
              parameters: { type: 'object', properties: {}, required: [] },
            },
            {
              name: 'get_weather',
              type: 'function',
              description: 'Get weather for a location',
            },
          ],
        },
      },
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'completion' },
    };
    mockLdClient.variation.mockResolvedValue(mockVariation);

    const result = await client.completionConfig(key, testContext, defaultValue);

    expect(result.tools).toBeDefined();
    expect(result.tools!['search'].name).toBe('search');
    expect(result.tools!['search'].type).toBe('function');
    expect(result.tools!['search'].description).toBe('Search the web');
    expect(result.tools!['search'].parameters).toEqual({
      type: 'object',
      properties: {},
      required: [],
    });
    expect(result.tools!['get_weather'].name).toBe('get_weather');
    expect(result.tools!['get_weather'].description).toBe('Get weather for a location');
  });

  it('uses root tools map over model.parameters.tools array when both are present', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';
    const defaultValue: LDAICompletionConfigDefault = { enabled: false };
    const rootTools = {
      'root-tool': { name: 'root-tool', type: 'function' },
    };
    const mockVariation = {
      model: {
        name: 'example-model',
        parameters: {
          tools: [{ name: 'params-tool', type: 'function' }],
        },
      },
      tools: rootTools,
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'completion' },
    };
    mockLdClient.variation.mockResolvedValue(mockVariation);

    const result = await client.completionConfig(key, testContext, defaultValue);

    expect(result.tools).toEqual(rootTools);
  });

  it('skips model.parameters.tools array entries without a name', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';
    const defaultValue: LDAICompletionConfigDefault = { enabled: false };
    const mockVariation = {
      model: {
        name: 'example-model',
        parameters: {
          tools: [
            { name: 'valid-tool', type: 'function' },
            { type: 'function', description: 'no name on this one' },
          ],
        },
      },
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'completion' },
    };
    mockLdClient.variation.mockResolvedValue(mockVariation);

    const result = await client.completionConfig(key, testContext, defaultValue);

    expect(result.tools).toBeDefined();
    expect(result.tools!['valid-tool'].name).toBe('valid-tool');
    expect(Object.keys(result.tools!)).toHaveLength(1);
  });

  it('returns undefined when model.parameters.tools is not an array', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';
    const defaultValue: LDAICompletionConfigDefault = { enabled: false };
    const mockVariation = {
      model: {
        name: 'example-model',
        parameters: { tools: 'not-an-array' },
      },
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'completion' },
    };
    mockLdClient.variation.mockResolvedValue(mockVariation);

    const result = await client.completionConfig(key, testContext, defaultValue);

    expect(result.tools).toBeUndefined();
  });
});

describe('template methods', () => {
  it('completionConfigTemplate preserves Mustache placeholders in messages', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';
    const defaultValue: LDAICompletionConfigDefault = { enabled: false };

    const mockVariation = {
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      messages: [
        { role: 'system', content: 'Hello {{name}}' },
        { role: 'user', content: 'Score: {{score}}' },
      ],
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'completion' },
    };
    mockLdClient.variation.mockResolvedValue(mockVariation);

    const result = await client.completionConfigTemplate(key, testContext, defaultValue);

    expect(result.messages).toEqual([
      { role: 'system', content: 'Hello {{name}}' },
      { role: 'user', content: 'Score: {{score}}' },
    ]);
    expect(result.enabled).toBe(true);
    expect(result.createTracker).toBeDefined();
  });

  it('completionConfigTemplate emits the correct usage tracking event', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';

    const mockVariation = {
      messages: [{ role: 'system', content: 'Hello {{name}}' }],
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'completion' },
    };
    mockLdClient.variation.mockResolvedValue(mockVariation);

    await client.completionConfigTemplate(key, testContext);

    expect(mockLdClient.track).toHaveBeenCalledWith(
      '$ld:ai:usage:completion-config-template',
      testContext,
      key,
      1,
    );
  });

  it('completionConfigTemplate uses disabled default when no defaultValue is provided', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';

    const mockVariation = {
      _ldMeta: { variationKey: 'v1', enabled: false, mode: 'completion' },
    };
    mockLdClient.variation.mockResolvedValue(mockVariation);

    const result = await client.completionConfigTemplate(key, testContext);

    expect(result.enabled).toBe(false);
  });

  it('agentConfigTemplate preserves Mustache placeholders in instructions', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-agent';
    const defaultValue: LDAIAgentConfigDefault = { enabled: false };

    const mockVariation = {
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      instructions: 'You are a research assistant specializing in {{topic}}.',
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'agent' },
    };
    mockLdClient.variation.mockResolvedValue(mockVariation);

    const result = await client.agentConfigTemplate(key, testContext, defaultValue);

    expect(result.instructions).toBe('You are a research assistant specializing in {{topic}}.');
    expect(result.enabled).toBe(true);
    expect(result.createTracker).toBeDefined();
  });

  it('agentConfigTemplate emits the correct usage tracking event', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-agent';

    const mockVariation = {
      instructions: 'You are a {{role}}.',
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'agent' },
    };
    mockLdClient.variation.mockResolvedValue(mockVariation);

    await client.agentConfigTemplate(key, testContext);

    expect(mockLdClient.track).toHaveBeenCalledWith(
      '$ld:ai:usage:agent-config-template',
      testContext,
      key,
      1,
    );
  });

  it('agentConfigTemplate uses disabled default when no defaultValue is provided', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-agent';

    const mockVariation = {
      _ldMeta: { variationKey: 'v1', enabled: false, mode: 'agent' },
    };
    mockLdClient.variation.mockResolvedValue(mockVariation);

    const result = await client.agentConfigTemplate(key, testContext);

    expect(result.enabled).toBe(false);
  });

  it('judgeConfigTemplate preserves Mustache placeholders in messages', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';
    const defaultValue: LDAIJudgeConfigDefault = { enabled: false };

    const mockVariation = {
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      evaluationMetricKey: 'relevance',
      messages: [
        { role: 'system', content: 'You are a judge evaluating {{criteria}}.' },
        { role: 'user', content: 'Score: {{score}}' },
      ],
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'judge' },
    };
    mockLdClient.variation.mockResolvedValue(mockVariation);

    const result = await client.judgeConfigTemplate(key, testContext, defaultValue);

    expect(result.messages).toEqual([
      { role: 'system', content: 'You are a judge evaluating {{criteria}}.' },
      { role: 'user', content: 'Score: {{score}}' },
    ]);
    expect(result.enabled).toBe(true);
    expect(result.createTracker).toBeDefined();
  });

  it('judgeConfigTemplate emits the correct usage tracking event', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';

    const mockVariation = {
      evaluationMetricKey: 'relevance',
      messages: [{ role: 'system', content: 'You are a {{role}}.' }],
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'judge' },
    };
    mockLdClient.variation.mockResolvedValue(mockVariation);

    await client.judgeConfigTemplate(key, testContext);

    expect(mockLdClient.track).toHaveBeenCalledWith(
      '$ld:ai:usage:judge-config-template',
      testContext,
      key,
      1,
    );
  });

  it('judgeConfigTemplate uses disabled default when no defaultValue is provided', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-judge';

    const mockVariation = {
      _ldMeta: { variationKey: 'v1', enabled: false, mode: 'judge' },
    };
    mockLdClient.variation.mockResolvedValue(mockVariation);

    const result = await client.judgeConfigTemplate(key, testContext);

    expect(result.enabled).toBe(false);
  });

  it('completionConfigTemplate does not apply ldctx interpolation', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-flag';

    const mockVariation = {
      messages: [{ role: 'system', content: 'User: {{ldctx.key}}' }],
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'completion' },
    };
    mockLdClient.variation.mockResolvedValue(mockVariation);

    const result = await client.completionConfigTemplate(key, testContext);

    expect(result.messages?.[0].content).toBe('User: {{ldctx.key}}');
  });

  it('agentConfigTemplate does not apply ldctx interpolation', async () => {
    const client = new LDAIClientImpl(mockLdClient);
    const key = 'test-agent';

    const mockVariation = {
      instructions: 'Context key: {{ldctx.key}}',
      _ldMeta: { variationKey: 'v1', enabled: true, mode: 'agent' },
    };
    mockLdClient.variation.mockResolvedValue(mockVariation);

    const result = await client.agentConfigTemplate(key, testContext);

    expect(result.instructions).toBe('Context key: {{ldctx.key}}');
  });
});
