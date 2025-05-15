import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDFeedbackKind } from '../src/api/metrics';
import { LDAIConfigTrackerImpl } from '../src/LDAIConfigTrackerImpl';
import { LDClientMin } from '../src/LDClientMin';

const mockTrack = jest.fn();
const mockVariation = jest.fn();
const mockLdClient: LDClientMin = {
  track: mockTrack,
  variation: mockVariation,
};

const testContext: LDContext = { kind: 'user', key: 'test-user' };
const configKey = 'test-config';
const variationKey = 'v1';
const version = 1;

beforeEach(() => {
  jest.clearAllMocks();
});

it('tracks duration', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackDuration(1000);

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:duration:total',
    testContext,
    { configKey, variationKey, version },
    1000,
  );
});

it('tracks duration of async function', async () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
    testContext,
  );
  jest.spyOn(global.Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

  const result = await tracker.trackDurationOf(async () => 'test-result');

  expect(result).toBe('test-result');
  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:duration:total',
    testContext,
    { configKey, variationKey, version },
    1000,
  );
});

it('tracks time to first token', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackTimeToFirstToken(1000);

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:ttf',
    testContext,
    { configKey, variationKey, version },
    1000,
  );
});

it('tracks positive feedback', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackFeedback({ kind: LDFeedbackKind.Positive });

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:feedback:user:positive',
    testContext,
    { configKey, variationKey, version },
    1,
  );
});

it('tracks negative feedback', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackFeedback({ kind: LDFeedbackKind.Negative });

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:feedback:user:negative',
    testContext,
    { configKey, variationKey, version },
    1,
  );
});

it('tracks custom event with data', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
    testContext,
  );
  const customData = { property: 'value', count: 42 };
  tracker.trackCustomEvent('test-event', customData);

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:custom:test-event',
    testContext,
    { configKey, variationKey, version, custom: customData },
    undefined,
  );
});

it('tracks custom event with metric value', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackCustomEvent('test-event', undefined, 123.45);

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:custom:test-event',
    testContext,
    { configKey, variationKey, version, custom: undefined },
    123.45,
  );
});

it('tracks custom event with both data and metric value', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
    testContext,
  );
  const customData = { property: 'value' };
  tracker.trackCustomEvent('test-event', customData, 123.45);

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:custom:test-event',
    testContext,
    { configKey, variationKey, version, custom: customData },
    123.45,
  );
});

it('tracks custom event with no data or metric value', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackCustomEvent('test-event');

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:custom:test-event',
    testContext,
    { configKey, variationKey, version, custom: undefined },
    undefined,
  );
});

it('tracks success', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackSuccess();

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation',
    testContext,
    { configKey, variationKey, version },
    1,
  );
});

it('tracks OpenAI usage', async () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
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
    { configKey, variationKey, version },
    1000,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation',
    testContext,
    { configKey, variationKey, version },
    1,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:total',
    testContext,
    { configKey, variationKey, version },
    TOTAL_TOKENS,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:input',
    testContext,
    { configKey, variationKey, version },
    PROMPT_TOKENS,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:output',
    testContext,
    { configKey, variationKey, version },
    COMPLETION_TOKENS,
  );
});

it('tracks error when OpenAI metrics function throws', async () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
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
    { configKey, variationKey, version },
    1000,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation',
    testContext,
    { configKey, variationKey, version },
    1,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation:error',
    testContext,
    { configKey, variationKey, version },
    1,
  );
});

it('tracks Bedrock conversation with successful response', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
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
    '$ld:ai:generation',
    testContext,
    { configKey, variationKey, version },
    1,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:duration:total',
    testContext,
    { configKey, variationKey, version },
    500,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:total',
    testContext,
    { configKey, variationKey, version },
    TOTAL_TOKENS,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:input',
    testContext,
    { configKey, variationKey, version },
    PROMPT_TOKENS,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:output',
    testContext,
    { configKey, variationKey, version },
    COMPLETION_TOKENS,
  );
});

it('tracks Bedrock conversation with error response', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
    testContext,
  );

  const response = {
    $metadata: { httpStatusCode: 400 },
  };

  tracker.trackBedrockConverseMetrics(response);

  expect(mockTrack).toHaveBeenCalledTimes(2);
  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation',
    testContext,
    { configKey, variationKey, version },
    1,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation:error',
    testContext,
    { configKey, variationKey, version },
    1,
  );
});

it('tracks tokens', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
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
    { configKey, variationKey, version },
    TOTAL_TOKENS,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:input',
    testContext,
    { configKey, variationKey, version },
    PROMPT_TOKENS,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:output',
    testContext,
    { configKey, variationKey, version },
    COMPLETION_TOKENS,
  );
});

it('only tracks non-zero token counts', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
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
    { configKey, variationKey, version },
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
    configKey,
    variationKey,
    version,
    testContext,
  );

  const summary = tracker.getSummary();

  expect(summary).toEqual({});
});

it('summarizes tracked metrics', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
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
  tracker.trackCustomEvent('event1', { test: 'data' });
  tracker.trackCustomEvent('event2', undefined, 42);

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
    customEvents: [
      {
        name: 'event1',
        data: { test: 'data' },
        metricValue: undefined
      },
      {
        name: 'event2',
        data: undefined,
        metricValue: 42
      }
    ]
  });
});

it('tracks duration when async function throws', async () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
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
    { configKey, variationKey, version },
    1000,
  );
});

it('tracks error', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackError();

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation',
    testContext,
    { configKey, variationKey, version },
    1,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation:error',
    testContext,
    { configKey, variationKey, version },
    1,
  );
});
