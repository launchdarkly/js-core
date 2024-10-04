import { AutoEnvAttributes, clone, type LDContext, LDLogger } from '@launchdarkly/js-sdk-common';

import LDClientImpl from '../src/LDClientImpl';
import LDEmitter from '../src/LDEmitter';
import { Flags, PatchFlag } from '../src/types';
import { createBasicPlatform } from './createBasicPlatform';
import * as mockResponseJson from './evaluation/mockResponse.json';
import { MockEventSource } from './streaming/LDClientImpl.mocks';
import { makeTestDataManagerFactory } from './TestDataManager';

let mockPlatform: ReturnType<typeof createBasicPlatform>;
let logger: LDLogger;

beforeEach(() => {
  mockPlatform = createBasicPlatform();
  logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
});

const testSdkKey = 'test-sdk-key';
const context: LDContext = { kind: 'org', key: 'Testy Pizza' };
const flagStorageKey = 'LaunchDarkly_1234567890123456_1234567890123456';
const indexStorageKey = 'LaunchDarkly_1234567890123456_ContextIndex';
let ldc: LDClientImpl;
let mockEventSource: MockEventSource;
let emitter: LDEmitter;
let defaultPutResponse: Flags;
let defaultFlagKeys: string[];

// Promisify on.change listener so we can await it in tests.
const onChangePromise = () =>
  new Promise<string[]>((res) => {
    ldc.on('change', (_context: LDContext, changes: string[]) => {
      res(changes);
    });
  });

describe('sdk-client change emitter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    defaultPutResponse = clone<Flags>(mockResponseJson);
    defaultFlagKeys = Object.keys(defaultPutResponse);

    (mockPlatform.storage.get as jest.Mock).mockImplementation((storageKey: string) => {
      switch (storageKey) {
        case flagStorageKey:
          return JSON.stringify(defaultPutResponse);
        case indexStorageKey:
          return undefined;
        default:
          return undefined;
      }
    });

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

    // @ts-ignore
    emitter = ldc.emitter;
    jest.spyOn(emitter as LDEmitter, 'emit');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('initialize from storage emits flags as changed', async () => {
    mockPlatform.requests.createEventSource.mockImplementation(
      (streamUri: string = '', options: any = {}) => {
        mockEventSource = new MockEventSource(streamUri, options);
        mockEventSource.simulateError({ status: 404, message: 'error-to-force-cache' });
        return mockEventSource;
      },
    );

    const changePromise = onChangePromise();
    await ldc.identify(context);
    await changePromise;

    expect(mockPlatform.storage.get).toHaveBeenCalledWith(flagStorageKey);

    expect(emitter.emit).toHaveBeenCalledWith('change', context, defaultFlagKeys);

    // a few specific flag changes to verify those are also called
    expect(emitter.emit).toHaveBeenCalledWith('change:moonshot-demo', context);
    expect(emitter.emit).toHaveBeenCalledWith('change:dev-test-flag', context);
    expect(emitter.emit).toHaveBeenCalledWith('change:this-is-a-test', context);
  });

  test('put should emit changed flags', async () => {
    const putResponse = clone<Flags>(defaultPutResponse);
    putResponse['dev-test-flag'].version = 999;
    putResponse['dev-test-flag'].value = false;

    const simulatedEvents = [{ data: JSON.stringify(putResponse) }];
    mockPlatform.requests.createEventSource.mockImplementation(
      (streamUri: string = '', options: any = {}) => {
        mockEventSource = new MockEventSource(streamUri, options);
        mockEventSource.simulateEvents('put', simulatedEvents);
        return mockEventSource;
      },
    );

    const changePromise = onChangePromise();
    await ldc.identify(context);
    await changePromise;
    await jest.runAllTimersAsync();

    expect(emitter.emit).toHaveBeenCalledWith('change', context, ['dev-test-flag']);
    expect(emitter.emit).toHaveBeenCalledWith('change:dev-test-flag', context);
  });

  test('patch should emit changed flags', async () => {
    const patchResponse = clone<PatchFlag>(defaultPutResponse['dev-test-flag']);
    patchResponse.key = 'dev-test-flag';
    patchResponse.value = false;
    patchResponse.version += 1;

    const putEvents = [{ data: JSON.stringify(defaultPutResponse) }];
    const patchEvents = [{ data: JSON.stringify(patchResponse) }];
    mockPlatform.requests.createEventSource.mockImplementation(
      (streamUri: string = '', options: any = {}) => {
        mockEventSource = new MockEventSource(streamUri, options);
        mockEventSource.simulateEvents('put', putEvents);
        mockEventSource.simulateEvents('patch', patchEvents);
        return mockEventSource;
      },
    );

    const changePromise = onChangePromise();
    await ldc.identify(context);
    await changePromise;
    await jest.runAllTimersAsync();

    expect(emitter.emit).toHaveBeenCalledWith('change', context, ['dev-test-flag']);
    expect(emitter.emit).toHaveBeenCalledWith('change:dev-test-flag', context);
  });

  test('delete should emit changed flags', async () => {
    const deleteResponse = {
      key: 'dev-test-flag',
      version: defaultPutResponse['dev-test-flag'].version + 1,
    };

    const putEvents = [{ data: JSON.stringify(defaultPutResponse) }];
    const deleteEvents = [{ data: JSON.stringify(deleteResponse) }];
    mockPlatform.requests.createEventSource.mockImplementation(
      (streamUri: string = '', options: any = {}) => {
        mockEventSource = new MockEventSource(streamUri, options);
        mockEventSource.simulateEvents('put', putEvents);
        mockEventSource.simulateEvents('delete', deleteEvents);
        return mockEventSource;
      },
    );

    const changePromise = onChangePromise();
    await ldc.identify(context);
    await changePromise;
    await jest.runAllTimersAsync();

    expect(emitter.emit).toHaveBeenCalledWith('change', context, ['dev-test-flag']);
    expect(emitter.emit).toHaveBeenCalledWith('change:dev-test-flag', context);
  });
});
