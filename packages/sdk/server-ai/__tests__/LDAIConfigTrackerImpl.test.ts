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
  modelVersion: 1,
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

it('returns summary with resumptionToken immediately after construction', () => {
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

  expect(summary.resumptionToken).toBe(tracker.resumptionToken);
  expect(typeof summary.resumptionToken).toBe('string');
  expect(summary.success).toBeUndefined();
  expect(summary.tokens).toBeUndefined();
  expect(summary.durationMs).toBeUndefined();
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
    resumptionToken: tracker.resumptionToken,
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

it('accumulates toolCalls in getSummary after trackToolCall', () => {
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

  tracker.trackToolCall('tool-a');
  tracker.trackToolCall('tool-b');

  const summary = tracker.getSummary();

  expect(summary.toolCalls).toEqual(['tool-a', 'tool-b']);
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
      tokens: { total: 100, input: 50, output: 50 },
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

describe('trackJudgeResult', () => {
  it('tracks metric key with score', () => {
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

    tracker.trackJudgeResult({
      judgeConfigKey: 'test-judge',
      success: true,
      sampled: true,
      score: 0.8,
      reasoning: 'The response is relevant',
      metricKey: 'relevance',
    });

    expect(mockTrack).toHaveBeenCalledWith(
      'relevance',
      testContext,
      { ...getExpectedTrackData(), judgeConfigKey: 'test-judge' },
      0.8,
    );
  });

  it('does not track when sampled is false', () => {
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

    tracker.trackJudgeResult({
      judgeConfigKey: 'test-judge',
      success: false,
      sampled: false,
      score: 0.8,
      metricKey: 'relevance',
    });

    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('does not track when success is false', () => {
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

    tracker.trackJudgeResult({
      judgeConfigKey: 'test-judge',
      success: false,
      sampled: true,
      score: 0.8,
      metricKey: 'relevance',
    });

    expect(mockTrack).not.toHaveBeenCalled();
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

  it('includes graphKey when set on constructor', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
      'my-graph',
    );

    tracker.trackToolCall('my-tool');

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

describe('trackStreamMetricsOf', () => {
  it('tracks tool calls from streaming metrics extractor', async () => {
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

    const mockStream = {};
    const metricsExtractor = jest.fn().mockResolvedValue({
      success: true,
      toolCalls: ['tool-a', 'tool-b'],
    });

    tracker.trackStreamMetricsOf(
      () => mockStream,
      metricsExtractor,
    );

    // Flush promises so the background tracking completes
    await Promise.resolve();
    await Promise.resolve();

    const summary = tracker.getSummary();
    expect(summary.toolCalls).toEqual(['tool-a', 'tool-b']);

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
  });
});

describe('graphKey constructor support', () => {
  it('includes graphKey in trackDuration event when set on constructor', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
      'my-graph',
    );

    tracker.trackDuration(1000);

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:duration:total',
      testContext,
      { ...getExpectedTrackData(), graphKey: 'my-graph' },
      1000,
    );
  });

  it('includes graphKey in trackSuccess event when set on constructor', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
      'my-graph',
    );

    tracker.trackSuccess();

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation:success',
      testContext,
      { ...getExpectedTrackData(), graphKey: 'my-graph' },
      1,
    );
  });

  it('does not include graphKey when not set on constructor', () => {
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

  it('includes graphKey in getTrackData when set on constructor', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
      'my-graph',
    );

    expect(tracker.getTrackData()).toEqual({
      ...getExpectedTrackData(),
      graphKey: 'my-graph',
    });
  });

  it('does not include graphKey in getTrackData when not set', () => {
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

    expect(tracker.getTrackData()).toEqual(getExpectedTrackData());
    expect('graphKey' in tracker.getTrackData()).toBe(false);
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
    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining('trackDuration'));
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

  it('includes graphKey in resumption token when set on constructor', () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
      'my-graph',
    );

    const token = tracker.resumptionToken;
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));

    expect(decoded).toEqual({
      runId: testRunId,
      configKey,
      variationKey,
      version,
      graphKey: 'my-graph',
    });
  });

  it('does not include graphKey in resumption token when not set', () => {
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
    expect('graphKey' in decoded).toBe(false);
  });

  it('reconstructs tracker with graphKey from resumption token', () => {
    const original = new LDAIConfigTrackerImpl(
      mockLdClient,
      testRunId,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
      'my-graph',
    );

    const reconstructed = LDAIConfigTrackerImpl.fromResumptionToken(
      original.resumptionToken,
      mockLdClient,
      testContext,
    );

    expect(reconstructed.getTrackData().graphKey).toBe('my-graph');
  });

  it('reconstructed tracker without graphKey does not include graphKey in track data', () => {
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

    expect('graphKey' in reconstructed.getTrackData()).toBe(false);
  });
});

it('includes modelKey and modelVersion in getTrackData when set on constructor', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
    undefined,
    'my-model',
    2,
  );

  expect(tracker.getTrackData()).toEqual({
    ...getExpectedTrackData(),
    modelKey: 'my-model',
    modelVersion: 2,
  });
});

it('omits modelKey from getTrackData when unset', () => {
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

  const trackData = tracker.getTrackData();
  expect('modelKey' in trackData).toBe(false);
  expect(trackData.modelVersion).toBe(1);
});

it('omits modelKey from getTrackData when empty string', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
    undefined,
    '',
    3,
  );

  const trackData = tracker.getTrackData();
  expect('modelKey' in trackData).toBe(false);
  expect(trackData.modelVersion).toBe(3);
});

it('excludes modelKey and modelVersion from resumption token', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
    undefined,
    'my-model',
    2,
  );

  const decoded = JSON.parse(Buffer.from(tracker.resumptionToken, 'base64url').toString('utf8'));
  expect('modelKey' in decoded).toBe(false);
  expect('modelVersion' in decoded).toBe(false);
});

it('fromResumptionToken defaults modelVersion to 1 and omits modelKey', () => {
  const original = new LDAIConfigTrackerImpl(
    mockLdClient,
    testRunId,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
    undefined,
    'my-model',
    2,
  );

  const reconstructed = LDAIConfigTrackerImpl.fromResumptionToken(
    original.resumptionToken,
    mockLdClient,
    testContext,
  );

  const trackData = reconstructed.getTrackData();
  expect('modelKey' in trackData).toBe(false);
  expect(trackData.modelVersion).toBe(1);
});
