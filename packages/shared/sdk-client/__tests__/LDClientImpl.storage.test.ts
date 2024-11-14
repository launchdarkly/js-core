import { AutoEnvAttributes, clone, type LDContext, LDLogger } from '@launchdarkly/js-sdk-common';

import { toMulti } from '../src/context/addAutoEnv';
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

describe('sdk-client storage', () => {
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

  test('initialize from storage succeeds without streaming', async () => {
    mockPlatform.requests.createEventSource.mockImplementation(
      (streamUri: string = '', options: any = {}) => {
        mockEventSource = new MockEventSource(streamUri, options);
        mockEventSource.simulateError({ status: 404, message: 'test-error' });
        return mockEventSource;
      },
    );

    const changePromise = onChangePromise();
    await ldc.identify(context);
    await changePromise;

    expect(mockPlatform.storage.get).toHaveBeenCalledWith(flagStorageKey);

    expect(emitter.emit).toHaveBeenCalledWith('change', context, defaultFlagKeys);
    expect(emitter.emit).toHaveBeenCalledWith(
      'error',
      context,
      expect.objectContaining({ message: 'test-error' }),
    );

    expect(ldc.allFlags()).toEqual({
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

  test('initialize from storage succeeds with auto env', async () => {
    mockPlatform.requests.createEventSource.mockImplementation(
      (streamUri: string = '', options: any = {}) => {
        mockEventSource = new MockEventSource(streamUri, options);
        mockEventSource.simulateError({ status: 404, message: 'test-error' });
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
    // @ts-ignore
    emitter = ldc.emitter;
    jest.spyOn(emitter as LDEmitter, 'emit');

    await ldc.identify(context);
    await jest.runAllTimersAsync();

    expect(mockPlatform.storage.get).toHaveBeenLastCalledWith(
      expect.stringMatching('LaunchDarkly_1234567890123456_1234567890123456'),
    );

    expect(emitter.emit).toHaveBeenCalledWith(
      'change',
      expect.objectContaining(toMulti(context)),
      defaultFlagKeys,
    );
    expect(emitter.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining(toMulti(context)),
      expect.objectContaining({ message: 'test-error' }),
    );
    expect(ldc.allFlags()).toEqual({
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

  test('not emitting change event when changed keys is empty', async () => {
    mockPlatform.requests.createEventSource.mockImplementation(
      (streamUri: string = '', options: any = {}) => {
        mockEventSource = new MockEventSource(streamUri, options);
        return mockEventSource;
      },
    );

    // @ts-ignore
    emitter = ldc.emitter;
    const spy = jest.spyOn(emitter as LDEmitter, 'emit');

    // expect emission
    await ldc.identify(context);
    expect(emitter.emit).toHaveBeenCalledWith('change', context, defaultFlagKeys);

    // clear the spy so we can tell if change was invoked again
    spy.mockClear();
    // expect no emission
    await ldc.identify(context);
    expect(emitter.emit).not.toHaveBeenCalledWith('change', context, defaultFlagKeys);
  });

  test('no storage, cold start from streaming', async () => {
    const simulatedEvents = [{ data: JSON.stringify(defaultPutResponse) }];
    mockPlatform.storage.get.mockImplementation(() => undefined);
    mockPlatform.requests.createEventSource.mockImplementation(
      (streamUri: string = '', options: any = {}) => {
        mockEventSource = new MockEventSource(streamUri, options);
        mockEventSource.simulateEvents('put', simulatedEvents);
        return mockEventSource;
      },
    );

    await ldc.identify(context);
    await jest.runAllTimersAsync();

    expect(mockPlatform.storage.set).toHaveBeenNthCalledWith(
      1,
      indexStorageKey,
      expect.stringContaining('index'),
    );

    expect(mockPlatform.storage.set).toHaveBeenNthCalledWith(
      2,
      flagStorageKey,
      JSON.stringify(defaultPutResponse),
    );

    // this is defaultPutResponse
    expect(ldc.allFlags()).toEqual({
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

  test('syncing storage when a flag is deleted', async () => {
    const putResponse = clone<Flags>(defaultPutResponse);
    delete putResponse['dev-test-flag'];

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

    expect(ldc.allFlags()).not.toHaveProperty('dev-test-flag');
    expect(mockPlatform.storage.set).toHaveBeenCalledTimes(2);
    expect(mockPlatform.storage.set).toHaveBeenNthCalledWith(
      1,
      indexStorageKey,
      expect.stringContaining('index'),
    );
    expect(mockPlatform.storage.set).toHaveBeenNthCalledWith(
      2,
      flagStorageKey,
      JSON.stringify(putResponse),
    );

    expect(emitter.emit).toHaveBeenCalledWith('change', context, defaultFlagKeys);
    expect(emitter.emit).toHaveBeenCalledWith('change', context, ['dev-test-flag']);
  });

  test('syncing storage when a flag is added', async () => {
    const putResponse = clone<Flags>(defaultPutResponse);
    putResponse['another-dev-test-flag'] = {
      version: 1,
      flagVersion: 2,
      value: false,
      variation: 1,
      trackEvents: false,
    };

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

    expect(ldc.allFlags()).toMatchObject({ 'another-dev-test-flag': false });
    expect(mockPlatform.storage.set).toHaveBeenCalledTimes(2);
    expect(mockPlatform.storage.set).toHaveBeenNthCalledWith(
      1,
      indexStorageKey,
      expect.stringContaining('index'),
    );
    expect(mockPlatform.storage.set).toHaveBeenNthCalledWith(
      2,
      flagStorageKey,
      JSON.stringify(putResponse),
    );
    expect(emitter.emit).toHaveBeenCalledWith('change', context, ['another-dev-test-flag']);
  });

  test('syncing storage when a flag is updated', async () => {
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

    expect(ldc.allFlags()).toMatchObject({ 'dev-test-flag': false });
    expect(emitter.emit).toHaveBeenCalledWith('change', context, ['dev-test-flag']);
  });

  test('syncing storage on multiple flag operations', async () => {
    const putResponse = clone<Flags>(defaultPutResponse);
    const newFlag = clone<Flags>(putResponse['dev-test-flag']);

    // flag updated, added and deleted
    putResponse['dev-test-flag'].value = false;
    putResponse['another-dev-test-flag'] = newFlag;
    delete putResponse['moonshot-demo'];

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

    expect(ldc.allFlags()).toMatchObject({ 'dev-test-flag': false, 'another-dev-test-flag': true });
    expect(ldc.allFlags()).not.toHaveProperty('moonshot-demo');
    expect(emitter.emit).toHaveBeenCalledWith('change', context, [
      'moonshot-demo',
      'dev-test-flag',
      'another-dev-test-flag',
    ]);
  });

  test('syncing storage when PUT is consistent so no change', async () => {
    const simulatedEvents = [{ data: JSON.stringify(defaultPutResponse) }];
    mockPlatform.requests.createEventSource.mockImplementation(
      (streamUri: string = '', options: any = {}) => {
        mockEventSource = new MockEventSource(streamUri, options);
        mockEventSource.simulateEvents('put', simulatedEvents);
        return mockEventSource;
      },
    );

    await ldc.identify(context);
    await jest.runAllTimersAsync();

    expect(mockPlatform.storage.set).toHaveBeenCalledTimes(2);
    expect(mockPlatform.storage.set).toHaveBeenNthCalledWith(
      1,
      indexStorageKey,
      expect.stringContaining('index'),
    );
    expect(mockPlatform.storage.set).toHaveBeenNthCalledWith(
      2,
      flagStorageKey,
      JSON.stringify(defaultPutResponse),
    );

    // we expect one change from the local storage init, but no further change from the PUT
    expect(emitter.emit).toHaveBeenCalledWith('change', context, defaultFlagKeys);

    // this is defaultPutResponse
    expect(ldc.allFlags()).toEqual({
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

  test('an update to inExperiment should emit change event', async () => {
    const putResponse = clone<Flags>(defaultPutResponse);
    putResponse['dev-test-flag'].reason = { kind: 'RULE_MATCH', inExperiment: true };

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

    const flagsInStorage = JSON.parse(mockPlatform.storage.set.mock.lastCall[1]) as Flags;
    expect(ldc.allFlags()).toMatchObject({ 'dev-test-flag': true });
    expect(flagsInStorage['dev-test-flag'].reason).toEqual({
      kind: 'RULE_MATCH',
      inExperiment: true,
    });

    // both previous and current are true but inExperiment has changed
    // so a change event should be emitted
    expect(emitter.emit).toHaveBeenCalledWith('change', context, ['dev-test-flag']);
  });

  test('patch should emit change event', async () => {
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

    const flagsInStorage = JSON.parse(mockPlatform.storage.set.mock.lastCall[1]) as Flags;
    expect(ldc.allFlags()).toMatchObject({ 'dev-test-flag': false });
    expect(mockPlatform.storage.set).toHaveBeenCalledTimes(4);
    expect(flagsInStorage['dev-test-flag'].version).toEqual(patchResponse.version);
    expect(emitter.emit).toHaveBeenCalledWith('change', context, ['dev-test-flag']);
  });

  test('patch should add new flags', async () => {
    const patchResponse = clone<PatchFlag>(defaultPutResponse['dev-test-flag']);
    patchResponse.key = 'another-dev-test-flag';

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

    const flagsInStorage = JSON.parse(mockPlatform.storage.set.mock.lastCall[1]) as Flags;
    expect(ldc.allFlags()).toHaveProperty('another-dev-test-flag');
    expect(mockPlatform.storage.set).toHaveBeenNthCalledWith(
      4,
      flagStorageKey,
      expect.stringContaining(JSON.stringify(patchResponse)),
    );
    expect(flagsInStorage).toHaveProperty('another-dev-test-flag');
    expect(emitter.emit).toHaveBeenCalledWith('change', context, ['another-dev-test-flag']);
  });

  test('patch should ignore older version', async () => {
    const patchResponse = clone<PatchFlag>(defaultPutResponse['dev-test-flag']);
    patchResponse.key = 'dev-test-flag';
    patchResponse.value = false;
    patchResponse.version -= 1;

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

    // the initial put is resulting in two sets, one for the index and one for the flag data
    expect(mockPlatform.storage.set).toHaveBeenCalledTimes(2);
    expect(emitter.emit).not.toHaveBeenCalledWith('change');

    // this is defaultPutResponse
    expect(ldc.allFlags()).toEqual({
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

  test('delete should emit change event', async () => {
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

    const flagsInStorage = JSON.parse(mockPlatform.storage.set.mock.lastCall[1]) as Flags;
    expect(ldc.allFlags()).not.toHaveProperty('dev-test-flag');
    expect(mockPlatform.storage.set).toHaveBeenNthCalledWith(
      4,
      flagStorageKey,
      expect.stringContaining('dev-test-flag'),
    );
    expect(flagsInStorage['dev-test-flag']).toMatchObject({ ...deleteResponse, deleted: true });
    expect(emitter.emit).toHaveBeenCalledWith('change', context, ['dev-test-flag']);
  });

  test('delete should not delete equal version', async () => {
    const deleteResponse = {
      key: 'dev-test-flag',
      version: defaultPutResponse['dev-test-flag'].version,
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

    expect(ldc.allFlags()).toHaveProperty('dev-test-flag');
    // the initial put is resulting in two sets, one for the index and one for the flag data
    expect(mockPlatform.storage.set).toHaveBeenCalledTimes(2);
    expect(emitter.emit).not.toHaveBeenCalledWith('change');
  });

  test('delete should not delete newer version', async () => {
    const deleteResponse = {
      key: 'dev-test-flag',
      version: defaultPutResponse['dev-test-flag'].version - 1,
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

    expect(ldc.allFlags()).toHaveProperty('dev-test-flag');
    // the initial put is resulting in two sets, one for the index and one for the flag data
    expect(mockPlatform.storage.set).toHaveBeenCalledTimes(2);
    expect(emitter.emit).not.toHaveBeenCalledWith('change');
  });

  test('delete should add and tombstone non-existing flag', async () => {
    const deleteResponse = {
      key: 'does-not-exist',
      version: 1,
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

    const flagsInStorage = JSON.parse(mockPlatform.storage.set.mock.lastCall[1]) as Flags;

    expect(mockPlatform.storage.set).toHaveBeenCalledTimes(4); // two index saves and two flag saves
    expect(flagsInStorage['does-not-exist']).toMatchObject({ ...deleteResponse, deleted: true });
    expect(emitter.emit).toHaveBeenCalledWith('change', context, ['does-not-exist']);
  });
});
