import { TrackedChat } from '../src/api/chat/TrackedChat';
import { ChatResponse } from '../src/api/chat/types';
import { LDAIConfigTracker } from '../src/api/config/LDAIConfigTracker';
import { LDAICompletionConfig } from '../src/api/config/types';
import { Evaluator } from '../src/api/judge/Evaluator';
import { LDJudgeResult } from '../src/api/judge/types';
import { AIProvider } from '../src/api/providers/AIProvider';

describe('TrackedChat.run()', () => {
  let mockProvider: jest.Mocked<AIProvider>;
  let mockTracker: jest.Mocked<LDAIConfigTracker>;
  let aiConfig: LDAICompletionConfig;

  const mockResponse: ChatResponse = {
    message: { role: 'assistant', content: 'AI response content' },
    metrics: { success: true },
  };

  beforeEach(() => {
    mockProvider = {
      invokeModel: jest.fn().mockResolvedValue(mockResponse),
    } as any;

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
      trackVercelAISDKGenerateTextMetrics: jest.fn(),
      trackStreamMetricsOf: jest.fn(),
      trackToolCall: jest.fn(),
      trackToolCalls: jest.fn(),
      getSummary: jest.fn(),
    } as any;

    aiConfig = {
      key: 'test-config',
      enabled: true,
      messages: [{ role: 'system', content: 'You are helpful.' }],
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      createTracker: () => mockTracker,
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

    const chat = new TrackedChat(configWithEvaluator, mockProvider);

    let evaluationsResolved = false;
    const resultPromise = chat.run('Hello');
    const result = await resultPromise;

    // result is immediately available
    expect(result.content).toBe('AI response content');

    // evaluations haven't resolved yet
    result.evaluations.then(() => {
      evaluationsResolved = true;
    });

    // microtask flush — evaluations should not have resolved yet
    await Promise.resolve();
    expect(evaluationsResolved).toBe(false);

    // Now resolve the evaluation
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

    const chat = new TrackedChat(configWithEvaluator, mockProvider);
    const result = await chat.run('Hello');

    // After awaiting evaluations, tracking IS complete
    await result.evaluations;
    expect(mockTracker.trackJudgeResult).toHaveBeenCalledWith(judgeResult);
  });

  it('builds ManagedResult with correct content and metrics', async () => {
    const chat = new TrackedChat(aiConfig, mockProvider);
    const result = await chat.run('test prompt');

    expect(result.content).toBe('AI response content');
    expect(result.metrics.success).toBe(true);
    expect(result.metrics.resumptionToken).toBe('test-resumption-token');
    expect(result.evaluations).toBeInstanceOf(Promise);
  });

  it('resolves to empty evaluations when no evaluator configured', async () => {
    const chat = new TrackedChat(aiConfig, mockProvider);
    const result = await chat.run('Hello');
    const evaluations = await result.evaluations;
    expect(evaluations).toEqual([]);
  });

  it('resolves to empty evaluations when evaluator is noop', async () => {
    const configWithNoop: LDAICompletionConfig = {
      ...aiConfig,
      evaluator: Evaluator.noop(),
    };
    const chat = new TrackedChat(configWithNoop, mockProvider);
    const result = await chat.run('Hello');
    const evaluations = await result.evaluations;
    expect(evaluations).toEqual([]);
  });
});
