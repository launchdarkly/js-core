import { ManagedModel } from '../src/api/ManagedModel';
import { LDAIConfigTracker } from '../src/api/config/LDAIConfigTracker';
import { LDAICompletionConfig } from '../src/api/config/types';
import { Evaluator } from '../src/api/judge/Evaluator';
import { LDJudgeResult } from '../src/api/judge/types';
import { RunnerResult } from '../src/api/model/types';
import { Runner } from '../src/api/providers/Runner';

describe('ManagedModel.run() evaluations', () => {
  let mockRunner: jest.Mocked<Runner>;
  let mockTracker: jest.Mocked<LDAIConfigTracker>;
  let aiConfig: LDAICompletionConfig;

  const runnerResult: RunnerResult = {
    content: 'AI response content',
    metrics: { success: true },
  };

  beforeEach(() => {
    mockRunner = {
      run: jest.fn().mockResolvedValue(runnerResult),
    };

    mockTracker = {
      trackMetricsOf: jest.fn().mockImplementation(async (_extractor: any, func: any) => func()),
      trackJudgeResult: jest.fn(),
      resumptionToken: 'test-resumption-token',
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
      trackVercelAIMetrics: jest.fn(),
      getSummary: jest
        .fn()
        .mockReturnValue({ success: true, resumptionToken: 'test-resumption-token' }),
    } as any;

    aiConfig = {
      key: 'test-config',
      enabled: true,
      messages: [{ role: 'system', content: 'You are helpful.' }],
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      createTracker: () => mockTracker,
      evaluator: Evaluator.noop(),
    };
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

    const configWithEvaluator: LDAICompletionConfig = {
      ...aiConfig,
      evaluator: slowEvaluator,
    };

    const model = new ManagedModel(configWithEvaluator, mockRunner);

    let evaluationsResolved = false;
    const result = await model.run('Hello');

    expect(result.content).toBe('AI response content');

    result.evaluations.then(() => {
      evaluationsResolved = true;
    });

    await Promise.resolve();
    expect(evaluationsResolved).toBe(false);

    resolveEval([{ success: true, sampled: true, score: 0.9 }]);
    await result.evaluations;
    expect(evaluationsResolved).toBe(true);
  });

  it('awaiting evaluations guarantees tracking is complete', async () => {
    const judgeResult: LDJudgeResult = {
      success: true,
      sampled: true,
      score: 0.8,
      metricKey: 'quality',
    };
    const mockEvaluator = {
      judgeConfiguration: { judges: [{ key: 'judge-1', samplingRate: 1.0 }] },
      evaluate: jest.fn().mockResolvedValue([judgeResult]),
      judges: new Map(),
    } as unknown as Evaluator;

    const configWithEvaluator: LDAICompletionConfig = {
      ...aiConfig,
      evaluator: mockEvaluator,
    };

    const model = new ManagedModel(configWithEvaluator, mockRunner);
    const result = await model.run('Hello');

    await result.evaluations;
    expect(mockTracker.trackJudgeResult).toHaveBeenCalledWith(judgeResult);
  });

  it('builds ManagedResult with correct content and metrics', async () => {
    const model = new ManagedModel(aiConfig, mockRunner);
    const result = await model.run('test prompt');

    expect(result.content).toBe('AI response content');
    expect(result.metrics.success).toBe(true);
    expect(result.metrics.resumptionToken).toBe('test-resumption-token');
    expect(result.evaluations).toBeInstanceOf(Promise);
  });

  it('resolves to empty evaluations when evaluator is noop', async () => {
    const configWithNoop: LDAICompletionConfig = {
      ...aiConfig,
      evaluator: Evaluator.noop(),
    };
    const model = new ManagedModel(configWithNoop, mockRunner);
    const result = await model.run('Hello');
    const evaluations = await result.evaluations;
    expect(evaluations).toEqual([]);
  });

  it('passes the prompt to evaluator.evaluate as input', async () => {
    const judgeResult: LDJudgeResult = {
      success: true,
      sampled: true,
      score: 1.0,
    };
    const mockEvaluator = {
      judgeConfiguration: { judges: [{ key: 'judge-1', samplingRate: 1.0 }] },
      evaluate: jest.fn().mockResolvedValue([judgeResult]),
      judges: new Map(),
    } as unknown as Evaluator;

    const configWithEvaluator: LDAICompletionConfig = {
      ...aiConfig,
      evaluator: mockEvaluator,
    };

    const model = new ManagedModel(configWithEvaluator, mockRunner);
    const result = await model.run('user prompt here');
    await result.evaluations;

    expect(mockEvaluator.evaluate).toHaveBeenCalledWith('user prompt here', 'AI response content');
  });
});
