import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDFeedbackKind } from '../src/api/metrics';
import { LDAIConfigTrackerImpl } from '../src/LDAIConfigTrackerImpl';
import { LDClientMin } from '../src/LDClientMin';

const testRunId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
jest.mock('node:crypto', () => ({
  randomUUID: jest.fn(() => testRunId),
}));

const mockTrack = jest.fn();
const mockVariation = jest.fn();
const mockWarn = jest.fn();
const mockLdClient: LDClientMin = {
  track: mockTrack,
  variation: mockVariation,
  logger: { warn: mockWarn, error: jest.fn(), info: jest.fn(), debug: jest.fn() } as any,
};

const testContext: LDContext = { kind: 'user', key: 'test-user' };
const configKey = 'test-config';
const variationKey = 'v1';
const version = 1;
const modelName = 'test-model';
const providerName = 'test-provider';

const getExpectedTrackData = () => ({
  configKey,
  variationKey,
  version,
  modelName,
  providerName,
  runId: testRunId,
});

beforeEach(() => {
  jest.clearAllMocks();
});

it('tracks duration', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
  );
  tracker.trackDuration(1000);

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:duration:total',
    testContext,
    getExpectedTrackData(),
    1000,
  );
});

it('tracks duration of async function', async () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
  );
  jest.spyOn(global.Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

  const result = await tracker.trackDurationOf(async () => 'test-result');

  expect(result).toBe('test-result');
  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:duration:total',
    testContext,
    getExpectedTrackData(),
    1000,
  );
});

it('tracks time to first token', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
  );
  tracker.trackTimeToFirstToken(1000);

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:ttf',
    testContext,
    getExpectedTrackData(),
    1000,
  );
});

it('tracks positive feedback', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
  );
  tracker.trackFeedback({ kind: LDFeedbackKind.Positive });

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:feedback:user:positive',
    testContext,
    getExpectedTrackData(),
    1,
  );
});

it('tracks negative feedback', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
  );
  tracker.trackFeedback({ kind: LDFeedbackKind.Negative });

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:feedback:user:negative',
    testContext,
    getExpectedTrackData(),
    1,
  );
});

it('tracks success', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
  );
  tracker.trackSuccess();

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation:success',
    testContext,
    getExpectedTrackData(),
    1,
  );
});

it('tracks OpenAI usage', async () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
  );
  jest.spyOn(global.Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

  const TOTAL_TOKENS = 100;
  const PROMPT_TOKENS = 49;
  const COMPLETION_TOKENS = 51;

  await tracker.trackOpenAIMetrics(async () => ({
    usage: {
      total_tokens: TOTAL_TOKENS,
      prompt_tokens: PROMPT_TOKENS,
      completion_tokens: COMPLETION_TOKENS,
    },
  }));

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:duration:total',
    testContext,
    getExpectedTrackData(),
    1000,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation:success',
    testContext,
    getExpectedTrackData(),
    1,
  );

  expect(mockTrack).not.toHaveBeenCalledWith(
    '$ld:ai:generation:error',
    expect.anything(),
    expect.anything(),
    expect.anything(),
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:total',
    testContext,
    getExpectedTrackData(),
    TOTAL_TOKENS,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:input',
    testContext,
    getExpectedTrackData(),
    PROMPT_TOKENS,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:output',
    testContext,
    getExpectedTrackData(),
    COMPLETION_TOKENS,
  );
});

it('tracks error when OpenAI metrics function throws', async () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
  );
  jest.spyOn(global.Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

  const error = new Error('OpenAI API error');
  await expect(
    tracker.trackOpenAIMetrics(async () => {
      throw error;
    }),
  ).rejects.toThrow(error);

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:duration:total',
    testContext,
    getExpectedTrackData(),
    1000,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation:error',
    testContext,
    getExpectedTrackData(),
    1,
  );

  expect(mockTrack).not.toHaveBeenCalledWith(
    expect.stringMatching(/^\$ld:ai:tokens:/),
    expect.anything(),
    expect.anything(),
    expect.anything(),
  );
});

it('tracks Bedrock conversation with successful response', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
  );

  const TOTAL_TOKENS = 100;
  const PROMPT_TOKENS = 49;
  const COMPLETION_TOKENS = 51;

  const response = {
    $metadata: { httpStatusCode: 200 },
    metrics: { latencyMs: 500 },
    usage: {
      inputTokens: PROMPT_TOKENS,
      outputTokens: COMPLETION_TOKENS,
      totalTokens: TOTAL_TOKENS,
    },
  };

  tracker.trackBedrockConverseMetrics(response);

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation:success',
    testContext,
    getExpectedTrackData(),
    1,
  );

  expect(mockTrack).not.toHaveBeenCalledWith(
    '$ld:ai:generation:error',
    expect.anything(),
    expect.anything(),
    expect.anything(),
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:duration:total',
    testContext,
    getExpectedTrackData(),
    500,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:total',
    testContext,
    getExpectedTrackData(),
    TOTAL_TOKENS,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:input',
    testContext,
    getExpectedTrackData(),
    PROMPT_TOKENS,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:output',
    testContext,
    getExpectedTrackData(),
    COMPLETION_TOKENS,
  );
});

it('tracks Bedrock conversation with error response', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
  );

  const response = {
    $metadata: { httpStatusCode: 400 },
  };

  tracker.trackBedrockConverseMetrics(response);

  expect(mockTrack).toHaveBeenCalledTimes(1);

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation:error',
    testContext,
    getExpectedTrackData(),
    1,
  );

  expect(mockTrack).not.toHaveBeenCalledWith(
    expect.stringMatching(/^\$ld:ai:tokens:/),
    expect.anything(),
    expect.anything(),
    expect.anything(),
  );
});

describe('Vercel AI SDK generateText', () => {
  it('tracks Vercel AI SDK usage', async () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );
    jest.spyOn(global.Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

    const TOTAL_TOKENS = 100;
    const PROMPT_TOKENS = 49;
    const COMPLETION_TOKENS = 51;

    await tracker.trackVercelAISDKGenerateTextMetrics(async () => ({
      usage: {
        totalTokens: TOTAL_TOKENS,
        promptTokens: PROMPT_TOKENS,
        completionTokens: COMPLETION_TOKENS,
      },
    }));

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:duration:total',
      testContext,
      getExpectedTrackData(),
      1000,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation:success',
      testContext,
      getExpectedTrackData(),
      1,
    );

    expect(mockTrack).not.toHaveBeenCalledWith(
      '$ld:ai:generation:error',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:tokens:total',
      testContext,
      getExpectedTrackData(),
      TOTAL_TOKENS,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:tokens:input',
      testContext,
      getExpectedTrackData(),
      PROMPT_TOKENS,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:tokens:output',
      testContext,
      getExpectedTrackData(),
      COMPLETION_TOKENS,
    );
  });

  it('tracks error when Vercel AI SDK metrics function throws', async () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );
    jest.spyOn(global.Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

    const error = new Error('Vercel AI SDK API error');
    await expect(
      tracker.trackVercelAISDKGenerateTextMetrics(async () => {
        throw error;
      }),
    ).rejects.toThrow(error);

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:duration:total',
      testContext,
      getExpectedTrackData(),
      1000,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation:error',
      testContext,
      getExpectedTrackData(),
      1,
    );

    expect(mockTrack).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\$ld:ai:tokens:/),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });
});

it('tracks tokens', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
  );

  const TOTAL_TOKENS = 100;
  const PROMPT_TOKENS = 49;
  const COMPLETION_TOKENS = 51;

  tracker.trackTokens({
    total: TOTAL_TOKENS,
    input: PROMPT_TOKENS,
    output: COMPLETION_TOKENS,
  });

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:total',
    testContext,
    getExpectedTrackData(),
    TOTAL_TOKENS,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:input',
    testContext,
    getExpectedTrackData(),
    PROMPT_TOKENS,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:output',
    testContext,
    getExpectedTrackData(),
    COMPLETION_TOKENS,
  );
});

it('only tracks non-zero token counts', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
  );

  tracker.trackTokens({
    total: 0,
    input: 50,
    output: 0,
  });

  expect(mockTrack).not.toHaveBeenCalledWith(
    '$ld:ai:tokens:total',
    expect.anything(),
    expect.anything(),
    expect.anything(),
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:input',
    testContext,
    getExpectedTrackData(),
    50,
  );

  expect(mockTrack).not.toHaveBeenCalledWith(
    '$ld:ai:tokens:output',
    expect.anything(),
    expect.anything(),
    expect.anything(),
  );
});

it('returns empty summary when no metrics tracked', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
  );

  const summary = tracker.getSummary();

  expect(summary).toEqual({});
});

it('summarizes tracked metrics', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
  );

  tracker.trackDuration(1000);
  tracker.trackTokens({
    total: 100,
    input: 40,
    output: 60,
  });
  tracker.trackFeedback({ kind: LDFeedbackKind.Positive });
  tracker.trackSuccess();

  const summary = tracker.getSummary();

  expect(summary).toEqual({
    durationMs: 1000,
    tokens: {
      total: 100,
      input: 40,
      output: 60,
    },
    feedback: {
      kind: 'positive',
    },
    success: true,
  });
});

it('tracks duration when async function throws', async () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
  );
  jest.spyOn(global.Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

  const error = new Error('test error');
  await expect(
    tracker.trackDurationOf(async () => {
      throw error;
    }),
  ).rejects.toThrow(error);

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:duration:total',
    testContext,
    getExpectedTrackData(),
    1000,
  );
});

it('tracks error', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
  );
  tracker.trackError();

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation:error',
    testContext,
    getExpectedTrackData(),
    1,
  );
});

describe('trackMetricsOf', () => {
  it('tracks success and token usage from metrics', async () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );

    const mockResult = { response: 'test' };
    const mockMetrics = {
      success: true,
      usage: { total: 100, input: 50, output: 50 },
    };

    const metricsExtractor = jest.fn().mockReturnValue(mockMetrics);
    const operation = jest.fn().mockResolvedValue(mockResult);

    const result = await tracker.trackMetricsOf(metricsExtractor, operation);

    expect(result).toBe(mockResult);
    expect(metricsExtractor).toHaveBeenCalledWith(mockResult);
    expect(operation).toHaveBeenCalled();

    // Should track success
    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation:success',
      testContext,
      getExpectedTrackData(),
      1,
    );

    // Should track token usage
    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:tokens:total',
      testContext,
      getExpectedTrackData(),
      100,
    );
    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:tokens:input',
      testContext,
      getExpectedTrackData(),
      50,
    );
    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:tokens:output',
      testContext,
      getExpectedTrackData(),
      50,
    );
  });

  it('tracks failure when metrics indicate failure', async () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );

    const mockResult = { response: 'test' };
    const mockMetrics = {
      success: false,
    };

    const metricsExtractor = jest.fn().mockReturnValue(mockMetrics);
    const operation = jest.fn().mockResolvedValue(mockResult);

    await tracker.trackMetricsOf(metricsExtractor, operation);

    // Should track error
    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation:error',
      testContext,
      getExpectedTrackData(),
      1,
    );
  });

  it('tracks failure when operation throws', async () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );

    const error = new Error('Operation failed');
    const metricsExtractor = jest.fn();
    const operation = jest.fn().mockRejectedValue(error);

    await expect(tracker.trackMetricsOf(metricsExtractor, operation)).rejects.toThrow(error);

    // Should track error
    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation:error',
      testContext,
      getExpectedTrackData(),
      1,
    );

    // Should not call metrics extractor when operation fails
    expect(metricsExtractor).not.toHaveBeenCalled();
  });

  it('tracks metrics without token usage', async () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );

    const mockResult = { response: 'test' };
    const mockMetrics = {
      success: true,
      // No usage provided
    };

    const metricsExtractor = jest.fn().mockReturnValue(mockMetrics);
    const operation = jest.fn().mockResolvedValue(mockResult);

    await tracker.trackMetricsOf(metricsExtractor, operation);

    // Should track success but not token usage
    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation:success',
      testContext,
      getExpectedTrackData(),
      1,
    );

    // Should not track token usage
    expect(mockTrack).not.toHaveBeenCalledWith(
      '$ld:ai:tokens:total',
      expect.any(Object),
      expect.any(Object),
      expect.any(Number),
    );
  });
});

describe('trackJudgeResponse', () => {
  it('tracks evaluation metric key with score', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );

    const judgeResponse = {
      judgeConfigKey: 'test-judge',
      evals: {
        relevance: { score: 0.8, reasoning: 'The response is relevant' },
      },
      success: true,
    };

    tracker.trackJudgeResponse(judgeResponse);

    expect(mockTrack).toHaveBeenCalledWith(
      'relevance',
      testContext,
      { ...getExpectedTrackData(), judgeConfigKey: 'test-judge' },
      0.8,
    );
  });

  it('tracks multiple evaluation metrics when present', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );

    const judgeResponse = {
      judgeConfigKey: 'test-judge',
      evals: {
        relevance: { score: 0.8, reasoning: 'Relevant' },
        accuracy: { score: 0.9, reasoning: 'Accurate' },
      },
      success: true,
    };

    tracker.trackJudgeResponse(judgeResponse);

    expect(mockTrack).toHaveBeenCalledWith(
      'relevance',
      testContext,
      { ...getExpectedTrackData(), judgeConfigKey: 'test-judge' },
      0.8,
    );
    expect(mockTrack).toHaveBeenCalledWith(
      'accuracy',
      testContext,
      { ...getExpectedTrackData(), judgeConfigKey: 'test-judge' },
      0.9,
    );
  });
});

describe('trackToolCall', () => {
  it('tracks a single tool call', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );

    tracker.trackToolCall('my-tool');

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:tool_call',
      testContext,
      { ...getExpectedTrackData(), toolKey: 'my-tool' },
      1,
    );
  });

  it('includes graphKey when provided', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );

    tracker.trackToolCall('my-tool', 'my-graph');

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:tool_call',
      testContext,
      { ...getExpectedTrackData(), graphKey: 'my-graph', toolKey: 'my-tool' },
      1,
    );
  });
});

describe('trackToolCalls', () => {
  it('tracks multiple tool calls', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );

    tracker.trackToolCalls(['tool-a', 'tool-b', 'tool-c']);

    expect(mockTrack).toHaveBeenCalledTimes(3);
    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:tool_call',
      testContext,
      { ...getExpectedTrackData(), toolKey: 'tool-a' },
      1,
    );
    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:tool_call',
      testContext,
      { ...getExpectedTrackData(), toolKey: 'tool-b' },
      1,
    );
    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:tool_call',
      testContext,
      { ...getExpectedTrackData(), toolKey: 'tool-c' },
      1,
    );
  });
});

describe('graphKey parameter support', () => {
  it('includes graphKey in trackDuration event', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );

    tracker.trackDuration(1000, 'my-graph');

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:duration:total',
      testContext,
      { ...getExpectedTrackData(), graphKey: 'my-graph' },
      1000,
    );
  });

  it('includes graphKey in trackSuccess event', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );

    tracker.trackSuccess('my-graph');

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation:success',
      testContext,
      { ...getExpectedTrackData(), graphKey: 'my-graph' },
      1,
    );
  });

  it('does not include graphKey when not provided', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );

    tracker.trackSuccess();

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation:success',
      testContext,
      getExpectedTrackData(),
      1,
    );
  });
});

describe('at-most-once semantics', () => {
  it('drops duplicate trackDuration call with warning', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );
    tracker.trackDuration(1000);
    tracker.trackDuration(2000);

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining('Duration'));
  });

  it('drops duplicate trackSuccess call with warning', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );
    tracker.trackSuccess();
    tracker.trackSuccess();

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledTimes(1);
  });

  it('drops trackError call after trackSuccess with warning', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );
    tracker.trackSuccess();
    tracker.trackError();

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledTimes(1);
  });

  it('drops duplicate trackFeedback call with warning', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );
    tracker.trackFeedback({ kind: LDFeedbackKind.Positive });
    tracker.trackFeedback({ kind: LDFeedbackKind.Negative });

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledTimes(1);
  });

  it('drops duplicate trackTokens call with warning', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );
    tracker.trackTokens({ total: 100, input: 50, output: 50 });
    tracker.trackTokens({ total: 200, input: 100, output: 100 });

    // First call tracks 3 events (total, input, output), second is dropped
    expect(mockTrack).toHaveBeenCalledTimes(3);
    expect(mockWarn).toHaveBeenCalledTimes(1);
  });

  it('drops duplicate trackTimeToFirstToken call with warning', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );
    tracker.trackTimeToFirstToken(100);
    tracker.trackTimeToFirstToken(200);

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledTimes(1);
  });
});

describe('resumptionToken', () => {
  it('encodes runId, configKey, variationKey, and version as URL-safe Base64 JSON', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );

    const token = tracker.resumptionToken;
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));

    expect(decoded).toEqual({
      runId: testRunId,
      configKey,
      variationKey,
      version,
    });
  });

  it('includes empty variationKey explicitly when not set', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      '',
      version,
      modelName,
      providerName,
      testContext,
    );

    const token = tracker.resumptionToken;
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));

    expect(decoded).toEqual({
      runId: testRunId,
      configKey,
      variationKey: '',
      version,
    });
    expect('variationKey' in decoded).toBe(true);
  });

  it('uses URL-safe Base64 encoding (no + / or = characters)', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );

    const token = tracker.resumptionToken;
    expect(token).not.toMatch(/[+/=]/);
  });
});

describe('fromResumptionToken', () => {
  it('reconstructs tracker with original runId', () => {
    const original = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );

    const reconstructed = LDAIConfigTrackerImpl.fromResumptionToken(
      original.resumptionToken,
      mockLdClient,
      testContext,
    );

    expect(reconstructed.getTrackData().runId).toBe(testRunId);
    expect(reconstructed.getTrackData().configKey).toBe(configKey);
    expect(reconstructed.getTrackData().variationKey).toBe(variationKey);
    expect(reconstructed.getTrackData().version).toBe(version);
  });

  it('reconstructs tracker with empty variationKey when none was set', () => {
    const original = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      '',
      version,
      modelName,
      providerName,
      testContext,
    );

    const reconstructed = LDAIConfigTrackerImpl.fromResumptionToken(
      original.resumptionToken,
      mockLdClient,
      testContext,
    );

    expect(reconstructed.getTrackData().variationKey).toBe('');
  });

  it('reconstructed tracker emits track events with original runId', () => {
    const original = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );

    const reconstructed = LDAIConfigTrackerImpl.fromResumptionToken(
      original.resumptionToken,
      mockLdClient,
      testContext,
    );

    reconstructed.trackSuccess();

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation:success',
      testContext,
      expect.objectContaining({ runId: testRunId }),
      1,
    );
  });
});
