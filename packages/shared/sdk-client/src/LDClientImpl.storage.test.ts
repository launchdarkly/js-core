import { AutoEnvAttributes, clone, type LDContext, noop } from '@launchdarkly/js-sdk-common';
import { basicPlatform, logger, setupMockStreamingProcessor } from '@launchdarkly/private-js-mocks';

import LDEmitter from './api/LDEmitter';
import * as mockResponseJson from './evaluation/mockResponse.json';
import LDClientImpl from './LDClientImpl';
import { DeleteFlag, Flag, Flags, PatchFlag } from './types';
import { toMulti } from './utils/addAutoEnv';

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
// 1. Sets up streamer
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

  // if streamer errors, don't wait for 'change' because it will not be sent.
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

    basicPlatform.storage.get.mockImplementation(() => JSON.stringify(defaultPutResponse));
    jest
      .spyOn(LDClientImpl.prototype as any, 'createStreamUriPath')
      .mockReturnValue('/stream/path');

    ldc = new LDClientImpl(testSdkKey, AutoEnvAttributes.Disabled, basicPlatform, {
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

  test('initialize from storage succeeds without streamer', async () => {
    // make sure streamer errors
    const allFlags = await identifyGetAllFlags(true, defaultPutResponse);

    expect(basicPlatform.storage.get).toHaveBeenCalledWith('org:Testy Pizza');

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
    ldc = new LDClientImpl(testSdkKey, AutoEnvAttributes.Enabled, basicPlatform, {
      logger,
      sendEvents: false,
    });
    // @ts-ignore
    emitter = ldc.emitter;
    jest.spyOn(emitter as LDEmitter, 'emit');

    const allFlags = await identifyGetAllFlags(true, defaultPutResponse);

    expect(basicPlatform.storage.get).toHaveBeenLastCalledWith(
      expect.stringMatching(/org:Testy Pizza$/),
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

  test('not emitting change event', async () => {
    jest.doMock('./utils', () => {
      const actual = jest.requireActual('./utils');
      return {
        ...actual,
        calculateFlagChanges: () => [],
      };
    });
    let LDClientImplTestNoChange;
    jest.isolateModules(async () => {
      LDClientImplTestNoChange = jest.requireActual('./LDClientImpl').default;
      ldc = new LDClientImplTestNoChange(testSdkKey, AutoEnvAttributes.Enabled, basicPlatform, {
        logger,
        sendEvents: false,
      });
    });

    // @ts-ignore
    emitter = ldc.emitter;
    jest.spyOn(emitter as LDEmitter, 'emit');

    await identifyGetAllFlags(true, defaultPutResponse);

    expect(emitter.emit).not.toHaveBeenCalled();
  });

  test('no storage, cold start from streamer', async () => {
    // fake previously cached flags even though there's no storage for this context
    // @ts-ignore
    ldc.flags = defaultPutResponse;
    basicPlatform.storage.get.mockImplementation(() => undefined);
    setupMockStreamingProcessor(false, defaultPutResponse);

    ldc.identify(context).then(noop);
    await jest.runAllTimersAsync();

    expect(basicPlatform.storage.set).toHaveBeenNthCalledWith(
      1,
      'org:Testy Pizza',
      JSON.stringify(defaultPutResponse),
    );
    expect(ldc.logger.debug).toHaveBeenCalledWith(
      'OnIdentifyResolve no changes to emit from: streamer PUT.',
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

    expect(allFlags).not.toHaveProperty('dev-test-flag');
    expect(basicPlatform.storage.set).toHaveBeenCalledWith(
      'org:Testy Pizza',
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

    expect(allFlags).toMatchObject({ 'another-dev-test-flag': false });
    expect(basicPlatform.storage.set).toHaveBeenCalledWith(
      'org:Testy Pizza',
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
    const newFlag = clone<Flag>(putResponse['dev-test-flag']);

    // flag updated, added and deleted
    putResponse['dev-test-flag'].value = false;
    putResponse['another-dev-test-flag'] = newFlag;
    delete putResponse['moonshot-demo'];
    const allFlags = await identifyGetAllFlags(false, putResponse);

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

    expect(basicPlatform.storage.set).toHaveBeenNthCalledWith(
      1,
      'org:Testy Pizza',
      JSON.stringify(defaultPutResponse),
    );
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
    const flagsInStorage = JSON.parse(basicPlatform.storage.set.mock.calls[0][1]) as Flags;

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
    const flagsInStorage = JSON.parse(basicPlatform.storage.set.mock.lastCall[1]) as Flags;

    expect(allFlags).toMatchObject({ 'dev-test-flag': false });
    expect(basicPlatform.storage.set).toHaveBeenCalledWith(
      'org:Testy Pizza',
      expect.stringContaining(JSON.stringify(patchResponse)),
    );
    expect(flagsInStorage['dev-test-flag'].version).toEqual(patchResponse.version);
    expect(emitter.emit).toHaveBeenCalledTimes(2);
    expect(emitter.emit).toHaveBeenNthCalledWith(2, 'change', context, ['dev-test-flag']);
  });

  test('patch should add new flags', async () => {
    const patchResponse = clone<PatchFlag>(defaultPutResponse['dev-test-flag']);
    patchResponse.key = 'another-dev-test-flag';

    const allFlags = await identifyGetAllFlags(false, defaultPutResponse, patchResponse);
    const flagsInStorage = JSON.parse(basicPlatform.storage.set.mock.lastCall[1]) as Flags;

    expect(allFlags).toHaveProperty('another-dev-test-flag');
    expect(basicPlatform.storage.set).toHaveBeenCalledWith(
      'org:Testy Pizza',
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

    expect(basicPlatform.storage.set).toHaveBeenCalledTimes(1);
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
    const flagsInStorage = JSON.parse(basicPlatform.storage.set.mock.lastCall[1]) as Flags;

    expect(allFlags).not.toHaveProperty('dev-test-flag');
    expect(basicPlatform.storage.set).toHaveBeenCalledWith(
      'org:Testy Pizza',
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
    expect(basicPlatform.storage.set).toHaveBeenCalledTimes(1);
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
    expect(basicPlatform.storage.set).toHaveBeenCalledTimes(1);
    expect(emitter.emit).not.toHaveBeenCalledWith('change');
  });

  test('delete should add and tombstone non-existing flag', async () => {
    const deleteResponse = {
      key: 'does-not-exist',
      version: 1,
    };

    await identifyGetAllFlags(false, defaultPutResponse, undefined, deleteResponse, false);
    const flagsInStorage = JSON.parse(basicPlatform.storage.set.mock.lastCall[1]) as Flags;

    expect(basicPlatform.storage.set).toHaveBeenCalledTimes(2);
    expect(flagsInStorage['does-not-exist']).toMatchObject({ ...deleteResponse, deleted: true });
    expect(emitter.emit).toHaveBeenCalledWith('change', context, ['does-not-exist']);
  });
});
