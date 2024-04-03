import { AutoEnvAttributes, clone, LDContext } from '@launchdarkly/js-sdk-common';
import { basicPlatform, logger, setupMockStreamingProcessor } from '@launchdarkly/private-js-mocks';

import * as mockResponseJson from './evaluation/mockResponse.json';
import LDClientImpl from './LDClientImpl';
import { Flags } from './types';
import { toMulti } from './utils/addAutoEnv';

jest.mock('@launchdarkly/js-sdk-common', () => {
  const actual = jest.requireActual('@launchdarkly/js-sdk-common');
  const m = jest.requireActual('@launchdarkly/private-js-mocks');
  return {
    ...actual,
    ...{
      internal: {
        ...actual.internal,
        StreamingProcessor: m.MockStreamingProcessor,
      },
    },
  };
});

const testSdkKey = 'test-sdk-key';
const carContext: LDContext = { kind: 'car', key: 'test-car' };

let ldc: LDClientImpl;
let defaultPutResponse: Flags;

describe('sdk-client identify timeout', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    defaultPutResponse = clone<Flags>(mockResponseJson);

    // simulate streamer error after a long timeout
    setupMockStreamingProcessor(true, defaultPutResponse, undefined, undefined, 30);

    ldc = new LDClientImpl(testSdkKey, AutoEnvAttributes.Enabled, basicPlatform, {
      logger,
      sendEvents: false,
    });
    jest
      .spyOn(LDClientImpl.prototype as any, 'createStreamUriPath')
      .mockReturnValue('/stream/path');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // streamer is setup to error in beforeEach to cause a timeout
  test('rejects with default timeout of 5s', async () => {
    jest.advanceTimersByTimeAsync(ldc.defaultIdentifyTimeout * 1000).then();
    await expect(ldc.identify(carContext)).rejects.toThrow(/identify timed out/);
  });

  // streamer is setup to error in beforeEach to cause a timeout
  test('rejects with custom timeout', async () => {
    const timeoutSeconds = 15;
    jest.advanceTimersByTimeAsync(timeoutSeconds * 1000).then();

    await expect(ldc.identify(carContext, { timeoutSeconds })).rejects.toThrow(
      /identify timed out/,
    );
  });

  test('resolves with default timeout', async () => {
    setupMockStreamingProcessor(false, defaultPutResponse);
    jest.advanceTimersByTimeAsync(ldc.defaultIdentifyTimeout * 1000).then();

    await expect(ldc.identify(carContext)).resolves.toBeUndefined();

    expect(ldc.getContext()).toEqual(expect.objectContaining(toMulti(carContext)));
    expect(ldc.allFlags()).toEqual({
      'dev-test-flag': true,
      'easter-i-tunes-special': false,
      'easter-specials': 'no specials',
      fdsafdsafdsafdsa: true,
      'log-level': 'warn',
      'moonshot-demo': true,
      test1: 's1',
      'this-is-a-test': true,
    });
  });

  test('resolves with custom timeout', async () => {
    const timeoutSeconds = 15;
    setupMockStreamingProcessor(false, defaultPutResponse);
    jest.advanceTimersByTimeAsync(timeoutSeconds).then();

    await expect(ldc.identify(carContext, { timeoutSeconds })).resolves.toBeUndefined();

    expect(ldc.getContext()).toEqual(expect.objectContaining(toMulti(carContext)));
    expect(ldc.allFlags()).toEqual({
      'dev-test-flag': true,
      'easter-i-tunes-special': false,
      'easter-specials': 'no specials',
      fdsafdsafdsafdsa: true,
      'log-level': 'warn',
      'moonshot-demo': true,
      test1: 's1',
      'this-is-a-test': true,
    });
  });

  test('setting default timeout with internalOptions', async () => {
    const sdkTimeout = 20;
    setupMockStreamingProcessor(false, defaultPutResponse);
    ldc = new LDClientImpl(
      testSdkKey,
      AutoEnvAttributes.Enabled,
      basicPlatform,
      {
        logger,
        sendEvents: false,
      },
      { defaultIdentifyTimeout: sdkTimeout },
    );
    const { defaultIdentifyTimeout } = ldc;
    jest.advanceTimersByTimeAsync(defaultIdentifyTimeout * 1000).then();

    await ldc.identify(carContext);

    expect(defaultIdentifyTimeout).toEqual(sdkTimeout);
    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringMatching(/too high/));
  });

  test('warning when timeout is too high', async () => {
    const { defaultIdentifyTimeout } = ldc;
    const dangerousTimeout = defaultIdentifyTimeout * 2;
    setupMockStreamingProcessor(false, defaultPutResponse);
    jest.advanceTimersByTimeAsync(defaultIdentifyTimeout * 1000).then();

    await ldc.identify(carContext, { timeoutSeconds: dangerousTimeout });

    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/too high/));
  });

  test('safe timeout should not warn', async () => {
    const { defaultIdentifyTimeout } = ldc;
    const safeTimeout = defaultIdentifyTimeout;
    setupMockStreamingProcessor(false, defaultPutResponse);
    jest.advanceTimersByTimeAsync(defaultIdentifyTimeout * 1000).then();

    await ldc.identify(carContext, { timeoutSeconds: safeTimeout });

    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringMatching(/too high/));
  });
});
