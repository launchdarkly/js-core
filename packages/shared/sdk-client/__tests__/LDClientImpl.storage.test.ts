import { AutoEnvAttributes, clone, type LDContext, noop } from '@launchdarkly/js-sdk-common';
import {
  createBasicPlatform,
  createLogger,
  setupMockStreamingProcessor,
} from '@launchdarkly/private-js-mocks';

import { toMulti } from '../src/context/addAutoEnv';
import LDClientImpl from '../src/LDClientImpl';
import LDEmitter from '../src/LDEmitter';
import { DeleteFlag, Flags, PatchFlag } from '../src/types';
import * as mockResponseJson from './evaluation/mockResponse.json';

let mockPlatform: ReturnType<typeof createBasicPlatform>;
let logger: ReturnType<typeof createLogger>;

beforeEach(() => {
  mockPlatform = createBasicPlatform();
  logger = createLogger();
});

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
const flagStorageKey = 'LaunchDarkly_1234567890123456_1234567890123456';
const indexStorageKey = 'LaunchDarkly_1234567890123456_ContextIndex';
let ldc: LDClientImpl;
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

// Common setup code for all tests
// 1. Sets up streaming
// 2. Sets up the change listener
// 3. Runs identify
// 4. Get all flags
const identifyGetAllFlags = async (
  shouldError: boolean = false,
  putResponse = defaultPutResponse,
  patchResponse?: PatchFlag,
  deleteResponse?: DeleteFlag,
  waitForChange: boolean = true,
) => {
  setupMockStreamingProcessor(shouldError, putResponse, patchResponse, deleteResponse);
  const changePromise = onChangePromise();

  try {
    await ldc.identify(context);
  } catch (e) {
    /* empty */
  }
  jest.runAllTimers();

  // if streaming errors, don't wait for 'change' because it will not be sent.
  if (waitForChange && !shouldError) {
    await changePromise;
  }

  return ldc.allFlags();
};

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

    jest
      .spyOn(LDClientImpl.prototype as any, 'createStreamUriPath')
      .mockReturnValue('/stream/path');

    ldc = new LDClientImpl(testSdkKey, AutoEnvAttributes.Disabled, mockPlatform, {
      logger,
      sendEvents: false,
    });

    // @ts-ignore
    emitter = ldc.emitter;
    jest.spyOn(emitter as LDEmitter, 'emit');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('initialize from storage succeeds without streaming', async () => {
    // make sure streaming errors
    const allFlags = await identifyGetAllFlags(true, defaultPutResponse);

    expect(mockPlatform.storage.get).toHaveBeenCalledWith(flagStorageKey);

    // 'change' should not have been emitted
    expect(emitter.emit).toHaveBeenCalledTimes(2);
    expect(emitter.emit).toHaveBeenNthCalledWith(1, 'change', context, defaultFlagKeys);
    expect(emitter.emit).toHaveBeenNthCalledWith(
      2,
      'error',
      context,
      expect.objectContaining({ message: 'test-error' }),
    );
    expect(allFlags).toEqual({
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

  test('initialize from storage succeeds with auto env', async () => {
    ldc = new LDClientImpl(testSdkKey, AutoEnvAttributes.Enabled, mockPlatform, {
      logger,
      sendEvents: false,
    });
    // @ts-ignore
    emitter = ldc.emitter;
    jest.spyOn(emitter as LDEmitter, 'emit');

    const allFlags = await identifyGetAllFlags(true, defaultPutResponse);

    expect(mockPlatform.storage.get).toHaveBeenLastCalledWith(
      expect.stringMatching('LaunchDarkly_1234567890123456_1234567890123456'),
    );

    // 'change' should not have been emitted
    expect(emitter.emit).toHaveBeenCalledTimes(2);
    expect(emitter.emit).toHaveBeenNthCalledWith(
      1,
      'change',
      expect.objectContaining(toMulti(context)),
      defaultFlagKeys,
    );
    expect(emitter.emit).toHaveBeenNthCalledWith(
      2,
      'error',
      expect.objectContaining(toMulti(context)),
      expect.objectContaining({ message: 'test-error' }),
    );
    expect(allFlags).toEqual({
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

  test('not emitting change event when changed keys is empty', async () => {
    let LDClientImplTestNoChange;
    jest.isolateModules(async () => {
      LDClientImplTestNoChange = jest.requireActual('../src/LDClientImpl').default;
      ldc = new LDClientImplTestNoChange(testSdkKey, AutoEnvAttributes.Enabled, mockPlatform, {
        logger,
        sendEvents: false,
      });
    });

    // @ts-ignore
    emitter = ldc.emitter;
    jest.spyOn(emitter as LDEmitter, 'emit');

    // expect emission
    await identifyGetAllFlags(true, defaultPutResponse);

    // expit no emission
    await identifyGetAllFlags(true, defaultPutResponse);

    expect(emitter.emit).toHaveBeenCalledTimes(1);
  });

  test('no storage, cold start from streaming', async () => {
    // fake previously cached flags even though there's no storage for this context
    // @ts-ignore
    ldc.flags = defaultPutResponse;
    mockPlatform.storage.get.mockImplementation(() => undefined);
    setupMockStreamingProcessor(false, defaultPutResponse);

    ldc.identify(context).then(noop);
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
      'log-level': 'warn',
      'moonshot-demo': true,
      test1: 's1',
      'this-is-a-test': true,
    });
  });

  test('syncing storage when a flag is deleted', async () => {
    const putResponse = clone<Flags>(defaultPutResponse);
    delete putResponse['dev-test-flag'];
    const allFlags = await identifyGetAllFlags(false, putResponse);

    // wait for async code to resolve promises
    await jest.runAllTimersAsync();

    expect(allFlags).not.toHaveProperty('dev-test-flag');
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

    expect(emitter.emit).toHaveBeenNthCalledWith(1, 'change', context, defaultFlagKeys);
    expect(emitter.emit).toHaveBeenNthCalledWith(2, 'change', context, ['dev-test-flag']);
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
    const allFlags = await identifyGetAllFlags(false, putResponse);

    // wait for async code to resolve promises
    await jest.runAllTimersAsync();

    expect(allFlags).toMatchObject({ 'another-dev-test-flag': false });
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
    expect(emitter.emit).toHaveBeenNthCalledWith(2, 'change', context, ['another-dev-test-flag']);
  });

  test('syncing storage when a flag is updated', async () => {
    const putResponse = clone<Flags>(defaultPutResponse);
    putResponse['dev-test-flag'].version = 999;
    putResponse['dev-test-flag'].value = false;
    const allFlags = await identifyGetAllFlags(false, putResponse);

    expect(allFlags).toMatchObject({ 'dev-test-flag': false });
    expect(emitter.emit).toHaveBeenNthCalledWith(2, 'change', context, ['dev-test-flag']);
  });

  test('syncing storage on multiple flag operations', async () => {
    const putResponse = clone<Flags>(defaultPutResponse);
    const newFlag = clone<Flags>(putResponse['dev-test-flag']);

    // flag updated, added and deleted
    putResponse['dev-test-flag'].value = false;
    putResponse['another-dev-test-flag'] = newFlag;
    delete putResponse['moonshot-demo'];
    const allFlags = await identifyGetAllFlags(false, putResponse);

    // wait for async code to resolve promises
    await jest.runAllTimersAsync();

    expect(allFlags).toMatchObject({ 'dev-test-flag': false, 'another-dev-test-flag': true });
    expect(allFlags).not.toHaveProperty('moonshot-demo');
    expect(emitter.emit).toHaveBeenNthCalledWith(2, 'change', context, [
      'moonshot-demo',
      'dev-test-flag',
      'another-dev-test-flag',
    ]);
  });

  test('syncing storage when PUT is consistent so no change', async () => {
    const allFlags = await identifyGetAllFlags(
      false,
      defaultPutResponse,
      undefined,
      undefined,
      false,
    );

    // wait for async code to resolve promises
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
    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenNthCalledWith(1, 'change', context, defaultFlagKeys);

    // this is defaultPutResponse
    expect(allFlags).toEqual({
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

  test('an update to inExperiment should emit change event', async () => {
    const putResponse = clone<Flags>(defaultPutResponse);
    putResponse['dev-test-flag'].reason = { kind: 'RULE_MATCH', inExperiment: true };

    const allFlags = await identifyGetAllFlags(false, putResponse);

    // wait for async code to resolve promises
    await jest.runAllTimersAsync();
    const flagsInStorage = JSON.parse(mockPlatform.storage.set.mock.lastCall[1]) as Flags;

    expect(allFlags).toMatchObject({ 'dev-test-flag': true });
    expect(flagsInStorage['dev-test-flag'].reason).toEqual({
      kind: 'RULE_MATCH',
      inExperiment: true,
    });

    // both previous and current are true but inExperiment has changed
    // so a change event should be emitted
    expect(emitter.emit).toHaveBeenNthCalledWith(2, 'change', context, ['dev-test-flag']);
  });

  test('patch should emit change event', async () => {
    const patchResponse = clone<PatchFlag>(defaultPutResponse['dev-test-flag']);
    patchResponse.key = 'dev-test-flag';
    patchResponse.value = false;
    patchResponse.version += 1;

    const allFlags = await identifyGetAllFlags(false, defaultPutResponse, patchResponse);

    // wait for async code to resolve promises
    await jest.runAllTimersAsync();

    const flagsInStorage = JSON.parse(mockPlatform.storage.set.mock.lastCall[1]) as Flags;
    expect(allFlags).toMatchObject({ 'dev-test-flag': false });
    expect(mockPlatform.storage.set).toHaveBeenCalledTimes(4);
    expect(flagsInStorage['dev-test-flag'].version).toEqual(patchResponse.version);
    expect(emitter.emit).toHaveBeenCalledTimes(2);
    expect(emitter.emit).toHaveBeenNthCalledWith(2, 'change', context, ['dev-test-flag']);
  });

  test('patch should add new flags', async () => {
    const patchResponse = clone<PatchFlag>(defaultPutResponse['dev-test-flag']);
    patchResponse.key = 'another-dev-test-flag';

    const allFlags = await identifyGetAllFlags(false, defaultPutResponse, patchResponse);

    // wait for async code to resolve promises
    await jest.runAllTimersAsync();

    const flagsInStorage = JSON.parse(mockPlatform.storage.set.mock.lastCall[1]) as Flags;
    expect(allFlags).toHaveProperty('another-dev-test-flag');
    expect(mockPlatform.storage.set).toHaveBeenNthCalledWith(
      4,
      flagStorageKey,
      expect.stringContaining(JSON.stringify(patchResponse)),
    );
    expect(flagsInStorage).toHaveProperty('another-dev-test-flag');
    expect(emitter.emit).toHaveBeenCalledTimes(2);
    expect(emitter.emit).toHaveBeenNthCalledWith(2, 'change', context, ['another-dev-test-flag']);
  });

  test('patch should ignore older version', async () => {
    const patchResponse = clone<PatchFlag>(defaultPutResponse['dev-test-flag']);
    patchResponse.key = 'dev-test-flag';
    patchResponse.value = false;
    patchResponse.version -= 1;

    const allFlags = await identifyGetAllFlags(
      false,
      defaultPutResponse,
      patchResponse,
      undefined,
      false,
    );

    expect(mockPlatform.storage.set).toHaveBeenCalledTimes(0);
    expect(emitter.emit).not.toHaveBeenCalledWith('change');

    // this is defaultPutResponse
    expect(allFlags).toEqual({
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

  test('delete should emit change event', async () => {
    const deleteResponse = {
      key: 'dev-test-flag',
      version: defaultPutResponse['dev-test-flag'].version + 1,
    };

    const allFlags = await identifyGetAllFlags(
      false,
      defaultPutResponse,
      undefined,
      deleteResponse,
    );

    // wait for async code to resolve promises
    await jest.runAllTimersAsync();

    const flagsInStorage = JSON.parse(mockPlatform.storage.set.mock.lastCall[1]) as Flags;
    expect(allFlags).not.toHaveProperty('dev-test-flag');
    expect(mockPlatform.storage.set).toHaveBeenNthCalledWith(
      4,
      flagStorageKey,
      expect.stringContaining('dev-test-flag'),
    );
    expect(flagsInStorage['dev-test-flag']).toMatchObject({ ...deleteResponse, deleted: true });
    expect(emitter.emit).toHaveBeenCalledTimes(2);
    expect(emitter.emit).toHaveBeenNthCalledWith(2, 'change', context, ['dev-test-flag']);
  });

  test('delete should not delete equal version', async () => {
    const deleteResponse = {
      key: 'dev-test-flag',
      version: defaultPutResponse['dev-test-flag'].version,
    };

    const allFlags = await identifyGetAllFlags(
      false,
      defaultPutResponse,
      undefined,
      deleteResponse,
      false,
    );

    expect(allFlags).toHaveProperty('dev-test-flag');
    expect(mockPlatform.storage.set).toHaveBeenCalledTimes(0);
    expect(emitter.emit).not.toHaveBeenCalledWith('change');
  });

  test('delete should not delete newer version', async () => {
    const deleteResponse = {
      key: 'dev-test-flag',
      version: defaultPutResponse['dev-test-flag'].version - 1,
    };

    const allFlags = await identifyGetAllFlags(
      false,
      defaultPutResponse,
      undefined,
      deleteResponse,
      false,
    );

    expect(allFlags).toHaveProperty('dev-test-flag');
    expect(mockPlatform.storage.set).toHaveBeenCalledTimes(0);
    expect(emitter.emit).not.toHaveBeenCalledWith('change');
  });

  test('delete should add and tombstone non-existing flag', async () => {
    const deleteResponse = {
      key: 'does-not-exist',
      version: 1,
    };

    await identifyGetAllFlags(false, defaultPutResponse, undefined, deleteResponse, false);

    // wait for async code to resolve promises
    await jest.runAllTimersAsync();

    const flagsInStorage = JSON.parse(mockPlatform.storage.set.mock.lastCall[1]) as Flags;

    expect(mockPlatform.storage.set).toHaveBeenCalledTimes(4); // two index saves and two flag saves
    expect(flagsInStorage['does-not-exist']).toMatchObject({ ...deleteResponse, deleted: true });
    expect(emitter.emit).toHaveBeenCalledWith('change', context, ['does-not-exist']);
  });
});