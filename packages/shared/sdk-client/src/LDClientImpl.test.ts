import { LDContext } from '@launchdarkly/js-sdk-common';
import {
  basicPlatform,
  logger,
  MockStreamingProcessor,
  setupMockStreamingProcessor,
} from '@launchdarkly/private-js-mocks';

import LDEmitter from './api/LDEmitter';
import fetchFlags from './evaluation/fetchFlags';
import * as mockResponseJson from './evaluation/mockResponse.json';
import LDClientImpl from './LDClientImpl';

jest.mock('./api/LDEmitter');
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
  const mockFetchFlags = fetchFlags as jest.Mock;

  let ldc: LDClientImpl;
  let mockEmitter: LDEmitter;

  beforeEach(() => {
    jest.useFakeTimers();
    setupMockStreamingProcessor(false, mockResponseJson);

    mockFetchFlags.mockResolvedValue(mockResponseJson);

    ldc = new LDClientImpl(testSdkKey, basicPlatform, { logger });
    jest
      .spyOn(LDClientImpl.prototype as any, 'createStreamUriPath')
      .mockReturnValue('/stream/path');
    [mockEmitter] = (LDEmitter as jest.Mock).mock.instances;
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

  test.only('all flags', async () => {
    await ldc.identify(context);
    jest.runAllTicks();
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
    mockFetchFlags.mockResolvedValue(mockResponseJson);
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
    expect(mockEmitter.emit).toHaveBeenNthCalledWith(1, 'error', expect.any(Error));
    expect(ldc.getContext()).toEqual(context);
  });

  test('identify error fetch error', async () => {
    // @ts-ignore
    mockFetchFlags.mockRejectedValue(new Error('unknown test fetch error'));
    const carContext: LDContext = { kind: 'car', key: 'mazda-3' };

    await expect(ldc.identify(carContext)).rejects.toThrowError(/fetch error/);
    expect(logger.error).toBeCalledTimes(1);
    expect(mockEmitter.emit).toHaveBeenNthCalledWith(1, 'error', expect.any(Error));
    expect(ldc.getContext()).toEqual(context);
  });
});
