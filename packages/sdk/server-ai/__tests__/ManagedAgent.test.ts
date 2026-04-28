import { ManagedAgent } from '../src/api/agent/ManagedAgent';
import { ChatResponse } from '../src/api/chat/types';
import { LDAIConfigTracker } from '../src/api/config/LDAIConfigTracker';
import { LDAIAgentConfig } from '../src/api/config/types';
import { Evaluator } from '../src/api/judge/Evaluator';
import { LDJudgeResult } from '../src/api/judge/types';
import { AIProvider } from '../src/api/providers/AIProvider';

describe('ManagedAgent', () => {
  let mockProvider: jest.Mocked<AIProvider>;
  let mockTracker: jest.Mocked<LDAIConfigTracker>;
  let agentConfig: LDAIAgentConfig;

  const mockResponse: ChatResponse = {
    message: { role: 'assistant', content: 'Agent response' },
    metrics: { success: true },
  };

  beforeEach(() => {
    mockProvider = {
      invokeModel: jest.fn().mockResolvedValue(mockResponse),
    } as any;

    mockTracker = {
      trackMetricsOf: jest.fn().mockImplementation(async (_extractor: any, func: any) => func()),
      trackJudgeResult: jest.fn(),
      resumptionToken: 'agent-resumption-token',
      getTrackData: jest.fn().mockReturnValue({}),
      trackDuration: jest.fn(),
      trackTokens: jest.fn(),
      trackSuccess: jest.fn(),
      trackError: jest.fn(),
      trackFeedback: jest.fn(),
      trackTimeToFirstToken: jest.fn(),
      trackDurationOf: jest.fn(),
      trackOpenAIMetrics: jest.fn(),
      trackBedrockConverseMetrics: jest.fn(),
      trackVercelAISDKGenerateTextMetrics: jest.fn(),
      trackStreamMetricsOf: jest.fn(),
      trackToolCall: jest.fn(),
      trackToolCalls: jest.fn(),
      getSummary: jest.fn(),
    } as any;

    agentConfig = {
      key: 'test-agent',
      enabled: true,
      instructions: 'You are a helpful agent.',
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      createTracker: () => mockTracker,
    };
  });

  it('run() returns a ManagedResult with content and metrics', async () => {
    const agent = new ManagedAgent(agentConfig, mockProvider);
    const result = await agent.run('Hello agent');

    expect(result.content).toBe('Agent response');
    expect(result.metrics.success).toBe(true);
    expect(result.metrics.resumptionToken).toBe('agent-resumption-token');
  });

  it('run() invokes the provider with the prompt as user message', async () => {
    const agent = new ManagedAgent(agentConfig, mockProvider);
    await agent.run('My question');

    expect(mockProvider.invokeModel).toHaveBeenCalledWith([
      { role: 'user', content: 'My question' },
    ]);
  });

  it('run() resolves to empty evaluations when no evaluator configured', async () => {
    const agent = new ManagedAgent(agentConfig, mockProvider);
    const result = await agent.run('Hello');
    const evaluations = await result.evaluations;
    expect(evaluations).toEqual([]);
  });

  it('run() resolves to empty evaluations with noop evaluator', async () => {
    const configWithNoop: LDAIAgentConfig = {
      ...agentConfig,
      evaluator: Evaluator.noop(),
    };
    const agent = new ManagedAgent(configWithNoop, mockProvider);
    const result = await agent.run('Hello');
    const evaluations = await result.evaluations;
    expect(evaluations).toEqual([]);
  });

  it('awaiting evaluations calls tracker.trackJudgeResult', async () => {
    const judgeResult: LDJudgeResult = {
      success: true,
      sampled: true,
      score: 0.85,
      metricKey: 'quality',
    };
    const mockEvaluator = {
      judgeConfiguration: { judges: [{ key: 'judge-1', samplingRate: 1.0 }] },
      evaluate: jest.fn().mockResolvedValue([judgeResult]),
      judges: new Map(),
    } as unknown as Evaluator;

    const configWithEvaluator: LDAIAgentConfig = {
      ...agentConfig,
      evaluator: mockEvaluator,
    };

    const agent = new ManagedAgent(configWithEvaluator, mockProvider);
    const result = await agent.run('Hello');

    await result.evaluations;
    expect(mockTracker.trackJudgeResult).toHaveBeenCalledWith(judgeResult);
  });

  it('evaluate() is called with prompt as input and response content as output', async () => {
    const mockEvaluator = {
      judgeConfiguration: { judges: [{ key: 'judge-1', samplingRate: 1.0 }] },
      evaluate: jest.fn().mockResolvedValue([]),
      judges: new Map(),
    } as unknown as Evaluator;

    const configWithEvaluator: LDAIAgentConfig = {
      ...agentConfig,
      evaluator: mockEvaluator,
    };

    const agent = new ManagedAgent(configWithEvaluator, mockProvider);
    const result = await agent.run('user prompt');
    await result.evaluations;

    expect(mockEvaluator.evaluate).toHaveBeenCalledWith('user prompt', 'Agent response');
  });

  it('getConfig() returns the agent config', () => {
    const agent = new ManagedAgent(agentConfig, mockProvider);
    expect(agent.getConfig()).toBe(agentConfig);
  });

  it('getProvider() returns the provider', () => {
    const agent = new ManagedAgent(agentConfig, mockProvider);
    expect(agent.getProvider()).toBe(mockProvider);
  });
});
