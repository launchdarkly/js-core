import { ManagedModel } from '../src/api/ManagedModel';
import { LDAIConfigTracker } from '../src/api/config/LDAIConfigTracker';
import { LDAICompletionConfig } from '../src/api/config/types';
import { RunnerResult } from '../src/api/model/types';
import { Runner } from '../src/api/providers/Runner';

describe('ManagedModel', () => {
  let mockRunner: jest.Mocked<Runner>;
  let mockTracker: jest.Mocked<LDAIConfigTracker>;
  let mockEvaluator: { evaluate: jest.Mock };
  let aiConfig: LDAICompletionConfig;

  beforeEach(() => {
    mockRunner = {
      run: jest.fn(),
    };

    mockTracker = {
      trackMetricsOf: jest.fn(),
      trackDuration: jest.fn(),
      trackTokens: jest.fn(),
      trackSuccess: jest.fn(),
      trackError: jest.fn(),
      trackFeedback: jest.fn(),
      trackTimeToFirstToken: jest.fn(),
      trackDurationOf: jest.fn(),
      trackBedrockConverseMetrics: jest.fn(),
      getSummary: jest.fn().mockReturnValue({}),
      trackJudgeResult: jest.fn(),
      resumptionToken: 'resumption-token-123',
    } as any;

    mockEvaluator = {
      evaluate: jest.fn().mockResolvedValue([]),
    };

    aiConfig = {
      key: 'test-config',
      enabled: true,
      messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      createTracker: () => mockTracker,
      evaluator: mockEvaluator as any,
    };
  });

  it('passes the prompt directly to the runner without prepending config messages', async () => {
    const runnerResult: RunnerResult = {
      content: 'Response from model',
      metrics: { success: true, tokens: { total: 10, input: 4, output: 6 } },
    };

    mockTracker.trackMetricsOf.mockImplementation(async (_extractor, func) => func());
    mockRunner.run.mockResolvedValue(runnerResult);

    const model = new ManagedModel(aiConfig, mockRunner);
    await model.run('Hello');

    expect(mockRunner.run).toHaveBeenCalledTimes(1);
    expect(mockRunner.run).toHaveBeenCalledWith('Hello');
  });

  it('returns a ManagedResult with content, metrics, and an evaluations promise', async () => {
    const runnerResult: RunnerResult = {
      content: 'Hi there',
      metrics: {
        success: true,
        tokens: { total: 12, input: 5, output: 7 },
        toolCalls: ['tool-1'],
        durationMs: 42,
      },
      raw: { providerSpecific: true },
    };

    const expectedSummary = {
      success: true,
      tokens: { total: 12, input: 5, output: 7 },
      toolCalls: ['tool-1'],
      durationMs: 42,
      resumptionToken: 'resumption-token-123',
    };

    mockTracker.trackMetricsOf.mockImplementation(async (_extractor, func) => func());
    mockTracker.getSummary.mockReturnValue(expectedSummary);
    mockRunner.run.mockResolvedValue(runnerResult);

    const model = new ManagedModel(aiConfig, mockRunner);
    const result = await model.run('say hi');

    expect(result.content).toBe('Hi there');
    expect(result.metrics).toEqual(expectedSummary);
    expect(result.raw).toEqual({ providerSpecific: true });
    await expect(result.evaluations).resolves.toEqual([]);
  });

  it('forwards the runner result through tracker.trackMetricsOf', async () => {
    const runnerResult: RunnerResult = {
      content: 'tracked',
      metrics: { success: true, tokens: { total: 1, input: 1, output: 0 } },
    };

    mockTracker.trackMetricsOf.mockImplementation(async (_extractor, func) => func());
    mockRunner.run.mockResolvedValue(runnerResult);

    const model = new ManagedModel(aiConfig, mockRunner);
    await model.run('prompt');

    expect(mockTracker.trackMetricsOf).toHaveBeenCalledTimes(1);
    const [extractor] = mockTracker.trackMetricsOf.mock.calls[0];
    // The extractor should pull metrics off the RunnerResult
    expect(extractor(runnerResult)).toBe(runnerResult.metrics);
  });

  it('does not retain conversation state across runs', async () => {
    const runnerResult: RunnerResult = {
      content: 'ok',
      metrics: { success: true, tokens: { total: 1, input: 1, output: 0 } },
    };

    mockTracker.trackMetricsOf.mockImplementation(async (_extractor, func) => func());
    mockRunner.run.mockResolvedValue(runnerResult);

    const model = new ManagedModel(aiConfig, mockRunner);

    await model.run('first');
    await model.run('second');

    // Each call passes only the latest prompt — no accumulated history.
    expect(mockRunner.run).toHaveBeenNthCalledWith(1, 'first');
    expect(mockRunner.run).toHaveBeenNthCalledWith(2, 'second');
  });

  it('exposes the AI config via getConfig', () => {
    const model = new ManagedModel(aiConfig, mockRunner);
    expect(model.getConfig()).toBe(aiConfig);
  });
});
