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
const modelName = 'test-model';
const providerName = 'test-provider';

beforeEach(() => {
  jest.clearAllMocks();
});

it('tracks duration', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
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
    { configKey, variationKey, version, modelName, providerName },
    1000,
  );
});

it('tracks duration of async function', async () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
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
    { configKey, variationKey, version, modelName, providerName },
    1000,
  );
});

it('tracks time to first token', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
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
    { configKey, variationKey, version, modelName, providerName },
    1000,
  );
});

it('tracks positive feedback', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
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
    { configKey, variationKey, version, modelName, providerName },
    1,
  );
});

it('tracks negative feedback', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
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
    { configKey, variationKey, version, modelName, providerName },
    1,
  );
});

it('tracks success', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
  );
  tracker.trackSuccess();

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
    1,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation:success',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
    1,
  );
});

it('tracks OpenAI usage', async () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
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
    { configKey, variationKey, version, modelName, providerName },
    1000,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
    1,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation:success',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
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
    { configKey, variationKey, version, modelName, providerName },
    TOTAL_TOKENS,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:input',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
    PROMPT_TOKENS,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:output',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
    COMPLETION_TOKENS,
  );
});

it('tracks error when OpenAI metrics function throws', async () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
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
    { configKey, variationKey, version, modelName, providerName },
    1000,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
    1,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation:error',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
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
    '$ld:ai:generation',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
    1,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation:success',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
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
    { configKey, variationKey, version, modelName, providerName },
    500,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:total',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
    TOTAL_TOKENS,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:input',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
    PROMPT_TOKENS,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:output',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
    COMPLETION_TOKENS,
  );
});

it('tracks Bedrock conversation with error response', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
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

  expect(mockTrack).toHaveBeenCalledTimes(2);
  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
    1,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation:error',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
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
      { configKey, variationKey, version, modelName, providerName },
      1000,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      1,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation:success',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
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
      { configKey, variationKey, version, modelName, providerName },
      TOTAL_TOKENS,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:tokens:input',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      PROMPT_TOKENS,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:tokens:output',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      COMPLETION_TOKENS,
    );
  });

  it('tracks error when Vercel AI SDK metrics function throws', async () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
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
      { configKey, variationKey, version, modelName, providerName },
      1000,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      1,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation:error',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
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

describe('Vercel AI SDK streamText', () => {
  it('tracks Vercel AI SDK usage', async () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
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

    let resolveDone: ((value: boolean) => void) | undefined;
    const donePromise = new Promise<boolean>((resolve) => {
      resolveDone = resolve;
    });

    const finishReason = Promise.resolve('stop');
    jest
      .spyOn(finishReason, 'then')
      .mockImplementationOnce((fn) => finishReason.then(fn).finally(() => resolveDone?.(true)));

    tracker.trackVercelAISDKStreamTextMetrics(() => ({
      finishReason,
      usage: Promise.resolve({
        totalTokens: TOTAL_TOKENS,
        promptTokens: PROMPT_TOKENS,
        completionTokens: COMPLETION_TOKENS,
      }),
    }));

    await donePromise;

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:duration:total',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      1000,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      1,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation:success',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
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
      { configKey, variationKey, version, modelName, providerName },
      TOTAL_TOKENS,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:tokens:input',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      PROMPT_TOKENS,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:tokens:output',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      COMPLETION_TOKENS,
    );
  });

  it('tracks error when Vercel AI SDK metrics function throws', async () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );
    jest.spyOn(global.Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

    const error = new Error('Vercel AI SDK API error');
    expect(() =>
      tracker.trackVercelAISDKStreamTextMetrics(() => {
        throw error;
      }),
    ).toThrow(error);

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:duration:total',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      1000,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      1,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation:error',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      1,
    );

    expect(mockTrack).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\$ld:ai:tokens:/),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('tracks error when Vercel AI SDK finishes because of an error', async () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );
    jest.spyOn(global.Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

    tracker.trackVercelAISDKStreamTextMetrics(() => ({
      finishReason: Promise.resolve('error'),
    }));

    await new Promise(process.nextTick);

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:duration:total',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      1000,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      1,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation:error',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      1,
    );

    expect(mockTrack).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\$ld:ai:tokens:/),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('tracks error when Vercel AI SDK finishReason promise rejects', async () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );
    jest.spyOn(global.Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

    tracker.trackVercelAISDKStreamTextMetrics(() => ({
      finishReason: Promise.reject(new Error('Vercel AI SDK API error')),
    }));

    await new Promise(process.nextTick);

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:duration:total',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      1000,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      1,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation:error',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      1,
    );

    expect(mockTrack).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\$ld:ai:tokens:/),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('squashes error when Vercel AI SDK usage promise rejects', async () => {
    const tracker = new LDAIConfigTrackerImpl(
      mockLdClient,
      configKey,
      variationKey,
      version,
      modelName,
      providerName,
      testContext,
    );
    jest.spyOn(global.Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

    tracker.trackVercelAISDKStreamTextMetrics(() => ({
      finishReason: Promise.resolve('stop'),
      usage: Promise.reject(new Error('Vercel AI SDK API error')),
    }));

    await new Promise(process.nextTick);

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:duration:total',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      1000,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      1,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:generation:success',
      testContext,
      { configKey, variationKey, version, modelName, providerName },
      1,
    );

    expect(mockTrack).not.toHaveBeenCalledWith(
      '$ld:ai:generation:error',
      expect.anything(),
      expect.anything(),
      expect.anything(),
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
    { configKey, variationKey, version, modelName, providerName },
    TOTAL_TOKENS,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:input',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
    PROMPT_TOKENS,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:tokens:output',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
    COMPLETION_TOKENS,
  );
});

it('only tracks non-zero token counts', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
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
    { configKey, variationKey, version, modelName, providerName },
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
    { configKey, variationKey, version, modelName, providerName },
    1000,
  );
});

it('tracks error', () => {
  const tracker = new LDAIConfigTrackerImpl(
    mockLdClient,
    configKey,
    variationKey,
    version,
    modelName,
    providerName,
    testContext,
  );
  tracker.trackError();

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
    1,
  );

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:generation:error',
    testContext,
    { configKey, variationKey, version, modelName, providerName },
    1,
  );
});
