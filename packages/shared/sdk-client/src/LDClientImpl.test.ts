import { LDContext } from '@launchdarkly/js-sdk-common';
import {
  basicPlatform,
  logger,
  MockStreamingProcessor,
  setupMockStreamingProcessor,
} from '@launchdarkly/private-js-mocks';

import * as mockResponseJson from './evaluation/mockResponse.json';
import LDClientImpl from './LDClientImpl';

jest.mock('./evaluation/fetchFlags');
jest.mock('@launchdarkly/js-sdk-common', () => {
  const actual = jest.requireActual('@launchdarkly/js-sdk-common');
  return {
    ...actual,
    ...{
      internal: {
        ...actual.internal,
        StreamingProcessor: MockStreamingProcessor,
      },
    },
  };
});
describe('sdk-client object', () => {
  const testSdkKey = 'test-sdk-key';
  const context: LDContext = { kind: 'org', key: 'Testy Pizza' };
  let ldc: LDClientImpl;

  beforeEach(() => {
    setupMockStreamingProcessor(false, mockResponseJson);

    ldc = new LDClientImpl(testSdkKey, basicPlatform, { logger });
    jest
      .spyOn(LDClientImpl.prototype as any, 'createStreamUriPath')
      .mockReturnValue('/stream/path');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('instantiate with blank options', () => {
    ldc = new LDClientImpl(testSdkKey, basicPlatform, {});
    expect(ldc.config).toMatchObject({
      allAttributesPrivate: false,
      baseUri: 'https://sdk.launchdarkly.com',
      capacity: 100,
      diagnosticOptOut: false,
      diagnosticRecordingInterval: 900,
      eventsUri: 'https://events.launchdarkly.com',
      flushInterval: 2,
      inspectors: [],
      logger: {
        destination: expect.any(Function),
        formatter: expect.any(Function),
        logLevel: 1,
        name: 'LaunchDarkly',
      },
      privateAttributes: [],
      sendEvents: true,
      sendLDHeaders: true,
      serviceEndpoints: {
        events: 'https://events.launchdarkly.com',
        polling: 'https://sdk.launchdarkly.com',
        streaming: 'https://clientstream.launchdarkly.com',
      },
      streamInitialReconnectDelay: 1,
      streamUri: 'https://clientstream.launchdarkly.com',
      tags: {},
      useReport: false,
      withReasons: false,
    });
  });

  test('all flags', async () => {
    await ldc.identify(context);
    const all = ldc.allFlags();

    expect(all).toEqual({
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

  test('variation', async () => {
    await ldc.identify(context);
    const devTestFlag = ldc.variation('dev-test-flag');

    expect(devTestFlag).toBe(true);
  });

  test('identify success', async () => {
    mockResponseJson['dev-test-flag'].value = false;
    const carContext: LDContext = { kind: 'car', key: 'mazda-cx7' };

    await ldc.identify(carContext);
    const c = ldc.getContext();
    const all = ldc.allFlags();

    expect(carContext).toEqual(c);
    expect(all).toMatchObject({
      'dev-test-flag': false,
    });
  });

  test('identify error invalid context', async () => {
    // @ts-ignore
    const carContext: LDContext = { kind: 'car', key: undefined };

    await expect(ldc.identify(carContext)).rejects.toThrowError(/no key/);
    expect(logger.error).toBeCalledTimes(1);
    expect(ldc.getContext()).toBeUndefined();
  });

  test('identify error stream error', async () => {
    setupMockStreamingProcessor(true);
    const carContext: LDContext = { kind: 'car', key: 'mazda-3' };

    await expect(ldc.identify(carContext)).rejects.toMatchObject({
      code: 401,
      message: 'test-error',
    });
    expect(logger.error).toBeCalledTimes(1);
    expect(ldc.getContext()).toEqual(carContext);
  });
});
