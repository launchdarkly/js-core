import { AutoEnvAttributes, clone, Hasher, LDContext, Platform } from '@launchdarkly/js-sdk-common';
import {
  basicPlatform,
  hasher,
  logger,
  MockStreamingProcessor,
  setupMockStreamingProcessor,
} from '@launchdarkly/private-js-mocks';

import * as mockResponseJson from './evaluation/mockResponse.json';
import LDClientImpl from './LDClientImpl';
import { Flags } from './types';

class MockHasher implements Hasher {
  private concated: string = '';

  update(data: string): Hasher {
    this.concated += data;
    return this;
  }
  digest(_encoding: string): string {
    return this.concated;
  }
}

jest.mock('@launchdarkly/js-sdk-common', () => {
  const actual = jest.requireActual('@launchdarkly/js-sdk-common');
  const actualMock = jest.requireActual('@launchdarkly/private-js-mocks');
  return {
    ...actual,
    ...{
      internal: {
        ...actual.internal,
        StreamingProcessor: actualMock.MockStreamingProcessor,
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
    console.log('RESET ALL MOCKS');
    jest.resetAllMocks();
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

  test('identify success', async () => {
    defaultPutResponse['dev-test-flag'].value = false;
    const carContext: LDContext = { kind: 'car', key: 'test-car' };

    await ldc.identify(carContext);
    const c = ldc.getContext();
    const all = ldc.allFlags();

    expect(c).toEqual({
      kind: 'multi',
      car: { key: 'test-car' },
      ...autoEnv,
    });
    expect(all).toMatchObject({
      'dev-test-flag': false,
    });
    expect(MockStreamingProcessor).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      '/stream/path',
      expect.anything(),
      undefined,
      expect.anything(),
    );
  });

  test('identify success withReasons', async () => {
    const carContext: LDContext = { kind: 'car', key: 'test-car' };
    ldc = new LDClientImpl(testSdkKey, AutoEnvAttributes.Enabled, basicPlatform, {
      logger,
      sendEvents: false,
      withReasons: true,
    });

    await ldc.identify(carContext);

    expect(MockStreamingProcessor).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      '/stream/path?withReasons=true',
      expect.anything(),
      undefined,
      expect.anything(),
    );
  });

  test('identify success without auto env', async () => {
    defaultPutResponse['dev-test-flag'].value = false;
    const carContext: LDContext = { kind: 'car', key: 'test-car' };
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
    const carContext: LDContext = { kind: 'car', key: 'test-car' };

    await expect(ldc.identify(carContext)).rejects.toThrow('test-error');
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/^error:.*test-error/));
  });

  test('identify change and error listeners', async () => {
    // @ts-ignore
    const { emitter } = ldc;

    await ldc.identify(context);

    const carContext1: LDContext = { kind: 'car', key: 'test-car' };
    await ldc.identify(carContext1);

    const carContext2: LDContext = { kind: 'car', key: 'test-car-2' };
    await ldc.identify(carContext2);

    expect(emitter.listenerCount('change')).toEqual(1);
    expect(emitter.listenerCount('error')).toEqual(1);
  });

  it('can complete identification using storage', async () => {
    const data: Record<string, string> = {};
    basicPlatform.storage = {
      get: (key: string) => data[key],
      set: (key: string, value: string) => {
        data[key] = value;
      },
      clear: (key: string) => {
        delete data[key];
      },
    };

    // First identify should populate storage.
    await ldc.identify(context);

    expect(logger.debug).not.toHaveBeenCalledWith('Identify completing with cached flags');

    // Second identify should use storage.
    await ldc.identify(context);

    expect(logger.debug).toHaveBeenCalledWith('Identify completing with cached flags');
  });

  it('does not complete identify using storage when instructed to wait for the network response', async () => {
    const data: Record<string, string> = {};

    const isolateCrypto: Platform = {
      encoding: basicPlatform.encoding,
      info: basicPlatform.info,
      requests: basicPlatform.requests,
      crypto: {
        createHash: (type: string) => {
          console.log('CREATING HASHER', type);
          return new MockHasher();
        },
        createHmac: jest.fn(),
        randomUUID: jest.fn(() => 'VERY_RANDOM_ID'),
      },
      storage: {
        get: async (key: string) => data[key],
        set: async (key: string, value: string) => {
          data[key] = value;
        },
        clear: async (key: string) => {
          delete data[key];
        },
      },
    };

    const otherClient = new LDClientImpl(testSdkKey, AutoEnvAttributes.Disabled, isolateCrypto, {
      logger,
      sendEvents: false,
    });

    // First identify should populate storage.
    await otherClient.identify(context);

    expect(logger.debug).not.toHaveBeenCalledWith('Identify completing with cached flags');

    // Second identify would use storage, but we instruct it not to.
    await otherClient.identify(context, { waitForNetworkResults: true, timeout: 5 });

    expect(logger.debug).not.toHaveBeenCalledWith('Identify completing with cached flags');
  });
});
