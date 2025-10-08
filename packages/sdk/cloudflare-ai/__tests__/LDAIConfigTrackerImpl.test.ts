import { LDAIConfigTrackerImpl } from '../src/LDAIConfigTrackerImpl';
import type { LDClientMin } from '../src/LDClientMin';

describe('LDAIConfigTrackerImpl metrics', () => {
  let mockLDClient: jest.Mocked<LDClientMin>;
  let tracker: LDAIConfigTrackerImpl;
  const context = { kind: 'user', key: 'example-user-key', name: 'Sandy' } as any;

  beforeEach(() => {
    mockLDClient = {
      variation: jest.fn(),
      variationDetail: jest.fn(),
      track: jest.fn(),
    };

    tracker = new LDAIConfigTrackerImpl(
      mockLDClient,
      'ai-config-key',
      'variation-key',
      3,
      '@cf/test-model',
      'cloudflare-workers-ai',
      context,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('tracks success metric with metadata', () => {
    tracker.trackSuccess();

    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:generation:success',
      context,
      expect.objectContaining({
        aiConfigKey: 'ai-config-key',
        variationKey: 'variation-key',
        version: 3,
        model: '@cf/test-model',
        provider: 'cloudflare-workers-ai',
      }),
      1,
    );
  });

  it('tracks error metric with metadata', () => {
    tracker.trackError();

    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:generation:error',
      context,
      expect.any(Object),
      1,
    );
  });

  it('tracks duration metric', () => {
    tracker.trackDuration(1250);

    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:duration:total',
      context,
      expect.objectContaining({
        aiConfigKey: 'ai-config-key',
        variationKey: 'variation-key',
      }),
      1250,
    );
  });

  it('tracks token metrics', () => {
    tracker.trackTokens({ input: 5, output: 7, total: 12 });

    expect(mockLDClient.track).toHaveBeenNthCalledWith(
      1,
      '$ld:ai:tokens:total',
      context,
      expect.any(Object),
      12,
    );
    expect(mockLDClient.track).toHaveBeenNthCalledWith(
      2,
      '$ld:ai:tokens:input',
      context,
      expect.any(Object),
      5,
    );
    expect(mockLDClient.track).toHaveBeenNthCalledWith(
      3,
      '$ld:ai:tokens:output',
      context,
      expect.any(Object),
      7,
    );
  });

  it('tracks time to first token metric', () => {
    tracker.trackTimeToFirstToken(321);

    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:tokens:ttf',
      context,
      expect.objectContaining({
        model: '@cf/test-model',
      }),
      321,
    );
  });

  it('tracks aggregated metrics via trackMetrics helper', () => {
    tracker.trackMetrics({
      durationMs: 640,
      usage: { input: 2, output: 3, total: 5 },
      success: true,
    });

    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:duration:total',
      context,
      expect.any(Object),
      640,
    );
    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:generation:success',
      context,
      expect.any(Object),
      1,
    );
    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:tokens:total',
      context,
      expect.any(Object),
      5,
    );
  });

  it('tracks metrics from Workers AI promise responses', async () => {
    const dateSpy = jest.spyOn(Date, 'now');
    dateSpy.mockReturnValueOnce(1).mockReturnValueOnce(101);

    const result = await tracker.trackWorkersAIMetrics(async () => ({
      usage: {
        prompt_tokens: 4,
        completion_tokens: 6,
        total_tokens: 10,
      },
    }));

    expect(result).toEqual({
      usage: {
        prompt_tokens: 4,
        completion_tokens: 6,
        total_tokens: 10,
      },
    });

    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:duration:total',
      context,
      expect.any(Object),
      100,
    );
    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:generation:success',
      context,
      expect.any(Object),
      1,
    );
    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:tokens:input',
      context,
      expect.any(Object),
      4,
    );
    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:tokens:output',
      context,
      expect.any(Object),
      6,
    );
    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:tokens:total',
      context,
      expect.any(Object),
      10,
    );
  });

  it('tracks errors from Workers AI promise responses', async () => {
    const dateSpy = jest.spyOn(Date, 'now');
    dateSpy.mockReturnValueOnce(10).mockReturnValueOnce(30);

    await expect(
      tracker.trackWorkersAIMetrics(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:duration:total',
      context,
      expect.any(Object),
      20,
    );
    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:generation:error',
      context,
      expect.any(Object),
      1,
    );
  });

  it('tracks metrics from Workers AI streaming responses', async () => {
    const dateSpy = jest.spyOn(Date, 'now');
    dateSpy.mockReturnValueOnce(5).mockReturnValueOnce(155);

    const usagePromise = Promise.resolve({
      input_tokens: 8,
      output_tokens: 9,
    });
    const finishReason = Promise.resolve('stop');

    tracker.trackWorkersAIStreamMetrics(
      () =>
        ({
          usage: usagePromise,
          finishReason,
        }) as any,
    );

    await finishReason;
    await usagePromise;
    await Promise.resolve();

    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:duration:total',
      context,
      expect.any(Object),
      150,
    );
    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:generation:success',
      context,
      expect.any(Object),
      1,
    );
    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:tokens:input',
      context,
      expect.any(Object),
      8,
    );
    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:tokens:output',
      context,
      expect.any(Object),
      9,
    );
    expect(mockLDClient.track).toHaveBeenCalledWith(
      '$ld:ai:tokens:total',
      context,
      expect.any(Object),
      17,
    );
  });
});
