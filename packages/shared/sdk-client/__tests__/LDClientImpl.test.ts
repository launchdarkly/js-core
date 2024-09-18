import { AutoEnvAttributes, clone, Encoding, Hasher, LDContext } from '@launchdarkly/js-sdk-common';
import { createBasicPlatform, createLogger } from '@launchdarkly/private-js-mocks';

import LDClientImpl from '../src/LDClientImpl';
import { Flags } from '../src/types';
import * as mockResponseJson from './evaluation/mockResponse.json';
import { MockEventSource } from './streaming/LDClientImpl.mocks';

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

describe('sdk-client object', () => {
  let ldc: LDClientImpl;
  let mockEventSource: MockEventSource;
  let simulatedEvents: { data?: any }[] = [];
  let defaultPutResponse: Flags;
  let mockPlatform: ReturnType<typeof createBasicPlatform>;
  let logger: ReturnType<typeof createLogger>;

  beforeEach(() => {
    mockPlatform = createBasicPlatform();
    logger = createLogger();
    defaultPutResponse = clone<Flags>(mockResponseJson);
    mockPlatform.crypto.randomUUID.mockReturnValue('random1');
    const hasher = {
      update: jest.fn((): Hasher => hasher),
      digest: jest.fn(() => 'digested1'),
    };
    mockPlatform.crypto.createHash.mockReturnValue(hasher);

    jest.spyOn(LDClientImpl.prototype as any, 'getStreamingPaths').mockReturnValue({
      pathGet(_encoding: Encoding, _plainContextString: string): string {
        return '/stream/path/get';
      },
      pathReport(_encoding: Encoding, _plainContextString: string): string {
        return '/stream/path/report';
      },
    });

    simulatedEvents = [{ data: JSON.stringify(defaultPutResponse) }];
    mockPlatform.requests.getEventSourceCapabilities.mockImplementation(() => ({
      readTimeout: true,
      headers: true,
      customMethod: true,
    }));
    mockPlatform.requests.createEventSource.mockImplementation(
      (streamUri: string = '', options: any = {}) => {
        mockEventSource = new MockEventSource(streamUri, options);
        mockEventSource.simulateEvents('put', simulatedEvents);
        return mockEventSource;
      },
    );

    ldc = new LDClientImpl(testSdkKey, AutoEnvAttributes.Enabled, mockPlatform, {
      logger,
      sendEvents: false,
    });
  });

  afterEach(async () => {
    await ldc.close();
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
    const carContext: LDContext = { kind: 'car', key: 'test-car' };

    mockPlatform.crypto.randomUUID.mockReturnValue('random1');

    // need reference within test to run assertions against
    const mockCreateEventSource = jest.fn((streamUri: string = '', options: any = {}) => {
      mockEventSource = new MockEventSource(streamUri, options);
      mockEventSource.simulateEvents('put', [{ data: JSON.stringify(defaultPutResponse) }]);
      return mockEventSource;
    });
    mockPlatform.requests.createEventSource = mockCreateEventSource;

    await ldc.identify(carContext);
    const c = ldc.getContext();
    const all = ldc.allFlags();

    expect(c).toEqual({
      kind: 'multi',
      car: { key: 'test-car' },
      ...autoEnv,
    });
    expect(all).toMatchObject({
      'dev-test-flag': true,
    });
    expect(mockCreateEventSource).toHaveBeenCalledWith(
      expect.stringContaining('/stream/path'),
      expect.anything(),
    );
  });

  test('identify success withReasons', async () => {
    const carContext: LDContext = { kind: 'car', key: 'test-car' };

    // need reference within test to run assertions against
    const mockCreateEventSource = jest.fn((streamUri: string = '', options: any = {}) => {
      mockEventSource = new MockEventSource(streamUri, options);
      mockEventSource.simulateEvents('put', [{ data: JSON.stringify(defaultPutResponse) }]);
      return mockEventSource;
    });
    mockPlatform.requests.createEventSource = mockCreateEventSource;

    ldc = new LDClientImpl(testSdkKey, AutoEnvAttributes.Enabled, mockPlatform, {
      logger,
      sendEvents: false,
      withReasons: true,
    });

    await ldc.identify(carContext);

    expect(mockCreateEventSource).toHaveBeenCalledWith(
      expect.stringContaining('?withReasons=true'),
      expect.anything(),
    );
  });

  test('identify success useReport', async () => {
    const carContext: LDContext = { kind: 'car', key: 'test-car' };

    // need reference within test to run assertions against
    const mockCreateEventSource = jest.fn((streamUri: string = '', options: any = {}) => {
      mockEventSource = new MockEventSource(streamUri, options);
      mockEventSource.simulateEvents('put', [{ data: JSON.stringify(defaultPutResponse) }]);
      return mockEventSource;
    });
    mockPlatform.requests.createEventSource = mockCreateEventSource;

    ldc = new LDClientImpl(testSdkKey, AutoEnvAttributes.Enabled, mockPlatform, {
      logger,
      sendEvents: false,
      useReport: true,
    });

    await ldc.identify(carContext);

    expect(mockCreateEventSource).toHaveBeenCalledWith(
      expect.stringContaining('/stream/path/report'),
      expect.anything(),
    );
  });

  test('identify success without auto env', async () => {
    defaultPutResponse['dev-test-flag'].value = false;
    simulatedEvents = [{ data: JSON.stringify(defaultPutResponse) }];

    const carContext: LDContext = { kind: 'car', key: 'test-car' };
    ldc = new LDClientImpl(testSdkKey, AutoEnvAttributes.Disabled, mockPlatform, {
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
    simulatedEvents = [{ data: JSON.stringify(defaultPutResponse) }];

    const carContext: LDContext = { kind: 'car', anonymous: true, key: '' };

    mockPlatform.crypto.randomUUID.mockReturnValue('random1');

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
    mockPlatform.requests.createEventSource.mockImplementation(
      (streamUri: string = '', options: any = {}) => {
        mockEventSource = new MockEventSource(streamUri, options);
        mockEventSource.simulateError({ status: 404, message: 'test-error' });
        return mockEventSource;
      },
    );

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

  test('can complete identification using storage', async () => {
    const data: Record<string, string> = {};
    mockPlatform.storage.get.mockImplementation((key) => data[key]);
    mockPlatform.storage.set.mockImplementation((key: string, value: string) => {
      data[key] = value;
    });
    mockPlatform.storage.clear.mockImplementation((key: string) => {
      delete data[key];
    });

    // First identify should populate storage.
    await ldc.identify(context);

    expect(logger.debug).not.toHaveBeenCalledWith('Identify completing with cached flags');

    // Second identify should use storage.
    await ldc.identify(context);

    expect(logger.debug).toHaveBeenCalledWith('Identify completing with cached flags');
  });

  test('does not complete identify using storage when instructed to wait for the network response', async () => {
    const data: Record<string, string> = {};
    mockPlatform.storage.get.mockImplementation((key) => data[key]);
    mockPlatform.storage.set.mockImplementation((key: string, value: string) => {
      data[key] = value;
    });
    mockPlatform.storage.clear.mockImplementation((key: string) => {
      delete data[key];
    });

    // First identify should populate storage.
    await ldc.identify(context);

    expect(logger.debug).not.toHaveBeenCalledWith('Identify completing with cached flags');

    // Second identify would use storage, but we instruct it not to.
    await ldc.identify(context, { waitForNetworkResults: true, timeout: 5 });

    expect(logger.debug).not.toHaveBeenCalledWith('Identify completing with cached flags');
  });
});
