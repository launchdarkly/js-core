import { AutoEnvAttributes, clone, Hasher, LDContext, LDLogger } from '@launchdarkly/js-sdk-common';

import { DataSourceState } from '../src/datasource/DataSourceStatus';
import LDClientImpl from '../src/LDClientImpl';
import { Flags } from '../src/types';
import { createBasicPlatform } from './createBasicPlatform';
import * as mockResponseJson from './evaluation/mockResponse.json';
import { MockEventSource } from './streaming/LDClientImpl.mocks';
import { makeTestDataManagerFactory } from './TestDataManager';

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
  let logger: LDLogger;

  function onDataSourceChangePromise(numToAwait: number) {
    let countdown = numToAwait;
    // eslint-disable-next-line no-new
    return new Promise<void>((res) => {
      ldc.on('dataSourceStatus', () => {
        countdown -= 1;
        if (countdown === 0) {
          res();
        }
      });
    });
  }

  beforeEach(() => {
    mockPlatform = createBasicPlatform();
    logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    defaultPutResponse = clone<Flags>(mockResponseJson);
    mockPlatform.crypto.randomUUID.mockReturnValue('random1');
    const hasher = {
      update: jest.fn((): Hasher => hasher),
      digest: jest.fn(() => 'digested1'),
    };
    mockPlatform.crypto.createHash.mockReturnValue(hasher);

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

    ldc = new LDClientImpl(
      testSdkKey,
      AutoEnvAttributes.Enabled,
      mockPlatform,
      {
        logger,
        sendEvents: false,
      },
      makeTestDataManagerFactory(testSdkKey, mockPlatform),
    );
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
      'has-prereq-depth-1': true,
      'is-prereq': true,
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

    ldc = new LDClientImpl(
      testSdkKey,
      AutoEnvAttributes.Enabled,
      mockPlatform,
      {
        logger,
        sendEvents: false,
        withReasons: true,
      },
      makeTestDataManagerFactory(testSdkKey, mockPlatform),
    );

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

    ldc = new LDClientImpl(
      testSdkKey,
      AutoEnvAttributes.Enabled,
      mockPlatform,
      {
        logger,
        sendEvents: false,
        useReport: true,
      },
      makeTestDataManagerFactory(testSdkKey, mockPlatform),
    );

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
    ldc = new LDClientImpl(
      testSdkKey,
      AutoEnvAttributes.Disabled,
      mockPlatform,
      {
        logger,
        sendEvents: false,
      },
      makeTestDataManagerFactory(testSdkKey, mockPlatform),
    );

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

    await expect(ldc.identify(carContext)).resolves.toEqual({
      status: 'error',
      error: new Error('Context was unspecified or had no key'),
    });
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

    await expect(ldc.identify(carContext)).resolves.toEqual({
      status: 'error',
      error: new Error('test-error'),
    });
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenNthCalledWith(1, expect.stringMatching(/^error:.*test-error/));
    expect(logger.error).toHaveBeenNthCalledWith(2, expect.stringContaining('Received error 404'));
  });

  test('identify change and error listeners', async () => {
    // @ts-ignore
    const { emitter } = ldc;

    await ldc.identify(context);

    const carContext1: LDContext = { kind: 'car', key: 'test-car' };
    await ldc.identify(carContext1);

    const carContext2: LDContext = { kind: 'car', key: 'test-car-2' };
    await ldc.identify(carContext2);

    // No default listeners. This is important for clients to be able to determine if there are
    // any listeners and act on that information.
    expect(emitter.listenerCount('change')).toEqual(0);
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

  test('data source status emits valid when successful initialization', async () => {
    const carContext: LDContext = { kind: 'car', key: 'test-car' };

    mockPlatform.crypto.randomUUID.mockReturnValue('random1');

    // need reference within test to run assertions against
    const mockCreateEventSource = jest.fn((streamUri: string = '', options: any = {}) => {
      mockEventSource = new MockEventSource(streamUri, options);
      mockEventSource.simulateEvents('put', [{ data: JSON.stringify(defaultPutResponse) }]);
      return mockEventSource;
    });
    mockPlatform.requests.createEventSource = mockCreateEventSource;

    const spyListener = jest.fn();
    ldc.on('dataSourceStatus', spyListener);
    const changePromise = onDataSourceChangePromise(2);
    await ldc.identify(carContext);
    await changePromise;

    expect(spyListener).toHaveBeenCalledTimes(2);
    expect(spyListener).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        state: DataSourceState.Initializing,
        stateSince: expect.any(Number),
        lastError: undefined,
      }),
    );
    expect(spyListener).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        state: DataSourceState.Valid,
        stateSince: expect.any(Number),
        lastError: undefined,
      }),
    );
  });

  test('data source status emits closed when initialization encounters unrecoverable error', async () => {
    const carContext: LDContext = { kind: 'car', key: 'test-car' };

    mockPlatform.crypto.randomUUID.mockReturnValue('random1');

    // need reference within test to run assertions against
    const mockCreateEventSource = jest.fn((streamUri: string = '', options: any = {}) => {
      mockEventSource = new MockEventSource(streamUri, options);
      mockEventSource.simulateError({ status: 404, message: 'test-error' }); // unrecoverable error
      return mockEventSource;
    });
    mockPlatform.requests.createEventSource = mockCreateEventSource;

    const spyListener = jest.fn();
    ldc.on('dataSourceStatus', spyListener);
    const changePromise = onDataSourceChangePromise(2);
    await expect(ldc.identify(carContext)).resolves.toEqual({
      status: 'error',
      error: new Error('test-error'),
    });
    await changePromise;

    expect(spyListener).toHaveBeenCalledTimes(2);
    expect(spyListener).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        state: DataSourceState.Initializing,
        stateSince: expect.any(Number),
        lastError: undefined,
      }),
    );
    expect(spyListener).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        state: DataSourceState.Closed,
        stateSince: expect.any(Number),
        lastError: expect.anything(),
      }),
    );
  });

  test('closes event source when client is closed', async () => {
    const carContext: LDContext = { kind: 'car', key: 'test-car' };

    const mockCreateEventSource = jest.fn((streamUri: string = '', options: any = {}) => {
      mockEventSource = new MockEventSource(streamUri, options);
      mockEventSource.simulateEvents('put', [{ data: JSON.stringify(defaultPutResponse) }]);
      return mockEventSource;
    });
    mockPlatform.requests.createEventSource = mockCreateEventSource;

    await ldc.identify(carContext);
    expect(mockEventSource.closed).toBe(false);

    await ldc.close();
    expect(mockEventSource.closed).toBe(true);
  });
});
