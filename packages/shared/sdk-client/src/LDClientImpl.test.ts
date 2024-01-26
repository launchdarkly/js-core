import { AutoEnvAttributes, clone, LDContext } from '@launchdarkly/js-sdk-common';
import {
  basicPlatform,
  hasher,
  logger,
  setupMockStreamingProcessor,
} from '@launchdarkly/private-js-mocks';

import * as mockResponseJson from './evaluation/mockResponse.json';
import LDClientImpl from './LDClientImpl';
import { Flags } from './types';

jest.mock('@launchdarkly/js-sdk-common', () => {
  const actual = jest.requireActual('@launchdarkly/js-sdk-common');
  const { MockStreamingProcessor } = jest.requireActual('@launchdarkly/private-js-mocks');
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

const testSdkKey = 'test-sdk-key';
const context: LDContext = { kind: 'org', key: 'Testy Pizza' };
const autoEnv = {
  ld_application: {
    key: 'digested1',
    envAttributesVersion: '1.0',
    id: 'com.testapp.ld',
    name: 'LDApplication.TestApp',
    version: '1.1.1',
  },
  ld_device: {
    key: 'random1',
    envAttributesVersion: '1.0',
    manufacturer: 'coconut',
    os: { name: 'An OS', version: '1.0.1', family: 'orange' },
  },
};
let ldc: LDClientImpl;
let defaultPutResponse: Flags;

describe('sdk-client object', () => {
  beforeEach(() => {
    defaultPutResponse = clone<Flags>(mockResponseJson);
    setupMockStreamingProcessor(false, defaultPutResponse);
    basicPlatform.crypto.randomUUID.mockReturnValue('random1');
    hasher.digest.mockReturnValue('digested1');

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

  test('instantiate with blank options', () => {
    ldc = new LDClientImpl(testSdkKey, AutoEnvAttributes.Enabled, basicPlatform, {});

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

  test('variationDetail flag not found', async () => {
    await ldc.identify(context);
    const flag = ldc.variationDetail('does-not-exist', 'not-found');

    expect(flag).toEqual({
      reason: { errorKind: 'FLAG_NOT_FOUND', kind: 'ERROR' },
      value: 'not-found',
      variationIndex: null,
    });
  });

  test('variationDetail deleted flag not found', async () => {
    await ldc.identify(context);
    // @ts-ignore
    ldc.flags['dev-test-flag'].deleted = true;
    const flag = ldc.variationDetail('dev-test-flag', 'deleted');

    expect(flag).toEqual({
      reason: { errorKind: 'FLAG_NOT_FOUND', kind: 'ERROR' },
      value: 'deleted',
      variationIndex: null,
    });
  });

  test('identify success', async () => {
    defaultPutResponse['dev-test-flag'].value = false;
    const carContext: LDContext = { kind: 'car', key: 'mazda-cx7' };

    await ldc.identify(carContext);
    const c = ldc.getContext();
    const all = ldc.allFlags();

    expect(c).toEqual({
      kind: 'multi',
      car: { key: 'mazda-cx7' },
      ...autoEnv,
    });
    expect(all).toMatchObject({
      'dev-test-flag': false,
    });
  });

  test('identify success without auto env', async () => {
    defaultPutResponse['dev-test-flag'].value = false;
    const carContext: LDContext = { kind: 'car', key: 'mazda-cx7' };
    ldc = new LDClientImpl(testSdkKey, AutoEnvAttributes.Disabled, basicPlatform, {
      logger,
      sendEvents: false,
    });

    await ldc.identify(carContext);
    const c = ldc.getContext();
    const all = ldc.allFlags();

    expect(c).toEqual(carContext);
    expect(all).toMatchObject({
      'dev-test-flag': false,
    });
  });

  test('identify anonymous', async () => {
    defaultPutResponse['dev-test-flag'].value = false;
    const carContext: LDContext = { kind: 'car', anonymous: true, key: '' };

    await ldc.identify(carContext);
    const c = ldc.getContext();
    const all = ldc.allFlags();

    expect(c).toEqual({
      kind: 'multi',
      car: { anonymous: true, key: 'random1' },
      ...autoEnv,
    });
    expect(all).toMatchObject({
      'dev-test-flag': false,
    });
  });

  test('identify error invalid context', async () => {
    const carContext: LDContext = { kind: 'car', key: '' };

    await expect(ldc.identify(carContext)).rejects.toThrow(/no key/);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(ldc.getContext()).toBeUndefined();
  });

  test('identify error stream error', async () => {
    setupMockStreamingProcessor(true);
    const carContext: LDContext = { kind: 'car', key: 'mazda-3' };

    await expect(ldc.identify(carContext)).rejects.toMatchObject({
      code: 401,
      message: 'test-error',
    });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(ldc.getContext()).toBeUndefined();
  });

  test('identify change and error listeners', async () => {
    // @ts-ignore
    const { emitter } = ldc;

    await ldc.identify(context);

    const carContext1: LDContext = { kind: 'car', key: 'mazda-cx' };
    await ldc.identify(carContext1);

    const carContext2: LDContext = { kind: 'car', key: 'subaru-forrester' };
    await ldc.identify(carContext2);

    expect(emitter.listenerCount('change')).toEqual(1);
    expect(emitter.listenerCount('error')).toEqual(1);
  });
});
