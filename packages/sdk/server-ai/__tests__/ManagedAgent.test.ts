import { ManagedAgent } from '../src/api/ManagedAgent';
import { LDAIConfigTracker } from '../src/api/config/LDAIConfigTracker';
import { LDAIAgentConfig } from '../src/api/config/types';
import { Evaluator } from '../src/api/judge/Evaluator';
import { LDJudgeResult } from '../src/api/judge/types';
import { RunnerResult } from '../src/api/model/types';
import { Runner } from '../src/api/providers/Runner';

describe('ManagedAgent', () => {
  let mockRunner: jest.Mocked<Runner>;
  let mockTracker: jest.Mocked<LDAIConfigTracker>;
  let agentConfig: LDAIAgentConfig;

  const runnerResult: RunnerResult = {
    content: 'Agent response',
    metrics: { success: true },
  };

  beforeEach(() => {
    mockRunner = {
      run: jest.fn().mockResolvedValue(runnerResult),
    };

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
      trackBedrockConverseMetrics: jest.fn(),
      getSummary: jest.fn().mockReturnValue({ success: true, resumptionToken: 'agent-resumption-token' }),
    } as any;

    agentConfig = {
      key: 'test-agent',
      enabled: true,
      instructions: 'You are a helpful agent.',
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      createTracker: () => mockTracker,
      evaluator: Evaluator.noop(),
    };
  });

  it('returns a ManagedResult with content and metrics', async () => {
    const agent = new ManagedAgent(agentConfig, mockRunner);
    const result = await agent.run('Hello agent');

    expect(result.content).toBe('Agent response');
    expect(result.metrics.success).toBe(true);
    expect(result.metrics.resumptionToken).toBe('agent-resumption-token');
  });

  it('passes the prompt directly to the runner', async () => {
    const agent = new ManagedAgent(agentConfig, mockRunner);
    await agent.run('My question');

    expect(mockRunner.run).toHaveBeenCalledWith('My question');
  });

  it('resolves to empty evaluations with noop evaluator', async () => {
    const agent = new ManagedAgent(agentConfig, mockRunner);
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

    const agent = new ManagedAgent(configWithEvaluator, mockRunner);
    const result = await agent.run('Hello');

    await result.evaluations;
    expect(mockTracker.trackJudgeResult).toHaveBeenCalledWith(judgeResult);
  });

  it('passes the prompt to evaluator.evaluate as input', async () => {
    const mockEvaluator = {
      judgeConfiguration: { judges: [{ key: 'judge-1', samplingRate: 1.0 }] },
      evaluate: jest.fn().mockResolvedValue([]),
      judges: new Map(),
    } as unknown as Evaluator;

    const configWithEvaluator: LDAIAgentConfig = {
      ...agentConfig,
      evaluator: mockEvaluator,
    };

    const agent = new ManagedAgent(configWithEvaluator, mockRunner);
    const result = await agent.run('user prompt');
    await result.evaluations;

    expect(mockEvaluator.evaluate).toHaveBeenCalledWith('user prompt', 'Agent response');
  });

  it('returns before evaluations resolve', async () => {
    let resolveEval!: (v: LDJudgeResult[]) => void;
    const slowEvaluator = {
      judgeConfiguration: { judges: [{ key: 'judge-1', samplingRate: 1.0 }] },
      evaluate: jest.fn().mockReturnValue(
        new Promise<LDJudgeResult[]>((resolve) => {
          resolveEval = resolve;
        }),
      ),
      judges: new Map(),
    } as unknown as Evaluator;

    const configWithEvaluator: LDAIAgentConfig = {
      ...agentConfig,
      evaluator: slowEvaluator,
    };

    const agent = new ManagedAgent(configWithEvaluator, mockRunner);

    let evaluationsResolved = false;
    const result = await agent.run('Hello');

    expect(result.content).toBe('Agent response');

    result.evaluations.then(() => {
      evaluationsResolved = true;
    });

    await Promise.resolve();
    expect(evaluationsResolved).toBe(false);

    resolveEval([{ success: true, sampled: true, score: 0.9 }]);
    await result.evaluations;
    expect(evaluationsResolved).toBe(true);
  });

  it('exposes the agent config via getConfig', () => {
    const agent = new ManagedAgent(agentConfig, mockRunner);
    expect(agent.getConfig()).toBe(agentConfig);
  });
});
