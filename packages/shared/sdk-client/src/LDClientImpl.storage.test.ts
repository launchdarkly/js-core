import { clone, type LDContext, LDFlagChangeset } from '@launchdarkly/js-sdk-common';
import { basicPlatform, logger, setupMockStreamingProcessor } from '@launchdarkly/private-js-mocks';

import LDEmitter from './api/LDEmitter';
import type { Flag, Flags } from './evaluation/fetchFlags';
import * as mockResponseJson from './evaluation/mockResponse.json';
import LDClientImpl from './LDClientImpl';

jest.mock('@launchdarkly/js-sdk-common', () => {
  const actual = jest.requireActual('@launchdarkly/js-sdk-common');
  const { MockStreamingProcessor: mockStreamer } = jest.requireActual(
    '@launchdarkly/private-js-mocks',
  );
  return {
    ...actual,
    ...{
      internal: {
        ...actual.internal,
        StreamingProcessor: mockStreamer,
      },
    },
  };
});

const defaultPutResponse = mockResponseJson as Flags;
const testSdkKey = 'test-sdk-key';
const context: LDContext = { kind: 'org', key: 'Testy Pizza' };
let ldc: LDClientImpl;
let emitter: LDEmitter;

// Promisify on.change listener so we can await it in tests.
const onChangePromise = () =>
  new Promise<LDFlagChangeset>((res) => {
    ldc.on('change', (_context: LDContext, changeset: LDFlagChangeset) => {
      res(changeset);
    });
  });

// Common setup code for all tests
// 1. Sets up streamer
// 2. Sets up the change listener
// 3. Runs identify
// 4. Get all flags
const identifyGetAllFlags = async (
  putResponse = defaultPutResponse,
  shouldError: boolean = false,
) => {
  setupMockStreamingProcessor(shouldError, putResponse);
  const changePromise = onChangePromise();

  try {
    await ldc.identify(context);
  } catch (e) {
    /* empty */
  }
  jest.runAllTicks();

  // if streamer errors, don't wait for 'change' because it will not be sent.
  if (!shouldError) {
    await changePromise;
  }

  return ldc.allFlags();
};

describe('sdk-client storage', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    basicPlatform.storage.get.mockImplementation(() => JSON.stringify(defaultPutResponse));
    jest
      .spyOn(LDClientImpl.prototype as any, 'createStreamUriPath')
      .mockReturnValue('/stream/path');

    ldc = new LDClientImpl(testSdkKey, basicPlatform, { logger, sendEvents: false });

    // @ts-ignore
    emitter = ldc.emitter;
    jest.spyOn(emitter as LDEmitter, 'emit');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('initialize from storage succeeds without streamer', async () => {
    // make sure streamer errors
    const allFlags = await identifyGetAllFlags(defaultPutResponse, true);

    expect(basicPlatform.storage.get).toHaveBeenCalledWith('org:Testy Pizza');

    // 'change' should not have been emitted
    expect(emitter.emit).toHaveBeenCalledTimes(3);
    expect(emitter.emit).toHaveBeenNthCalledWith(1, 'initializing', context);
    expect(emitter.emit).toHaveBeenNthCalledWith(2, 'ready', context);
    expect(emitter.emit).toHaveBeenNthCalledWith(
      3,
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

  test('syncing storage when a flag is deleted', async () => {
    const putResponse = clone<Flags>(defaultPutResponse);
    delete putResponse['dev-test-flag'];
    const allFlags = await identifyGetAllFlags(putResponse);

    expect(allFlags).not.toHaveProperty('dev-test-flag');
    expect(basicPlatform.storage.set).toHaveBeenCalledWith(
      'org:Testy Pizza',
      JSON.stringify(putResponse),
    );
    expect(emitter.emit).toHaveBeenNthCalledWith(1, 'initializing', context);
    expect(emitter.emit).toHaveBeenNthCalledWith(2, 'ready', context);
    expect(emitter.emit).toHaveBeenNthCalledWith(3, 'change', context, {
      'dev-test-flag': { previous: true },
    });
  });

  test('syncing storage when a flag is added', async () => {
    const putResponse = clone<Flags>(defaultPutResponse);
    const newFlag = {
      version: 1,
      flagVersion: 2,
      value: false,
      variation: 1,
      trackEvents: false,
    };
    putResponse['another-dev-test-flag'] = newFlag;
    const allFlags = await identifyGetAllFlags(putResponse);

    expect(allFlags).toMatchObject({ 'another-dev-test-flag': false });
    expect(basicPlatform.storage.set).toHaveBeenCalledWith(
      'org:Testy Pizza',
      JSON.stringify(putResponse),
    );
    expect(emitter.emit).toHaveBeenNthCalledWith(3, 'change', context, {
      'another-dev-test-flag': { current: newFlag.value },
    });
  });

  test('syncing storage when a flag is updated', async () => {
    const putResponse = clone<Flags>(defaultPutResponse);
    putResponse['dev-test-flag'].version = 999;
    putResponse['dev-test-flag'].value = false;
    const allFlags = await identifyGetAllFlags(putResponse);

    expect(allFlags).toMatchObject({ 'dev-test-flag': false });
    expect(emitter.emit).toHaveBeenNthCalledWith(3, 'change', context, {
      'dev-test-flag': {
        previous: true,
        current: putResponse['dev-test-flag'].value,
      },
    });
  });

  test('syncing storage on multiple flag operations', async () => {
    const putResponse = clone<Flags>(defaultPutResponse);
    const newFlag = clone<Flag>(putResponse['dev-test-flag']);

    // flag updated, added and deleted
    putResponse['dev-test-flag'].value = false;
    putResponse['another-dev-test-flag'] = newFlag;
    delete putResponse['moonshot-demo'];
    const allFlags = await identifyGetAllFlags(putResponse);

    expect(allFlags).toMatchObject({ 'dev-test-flag': false, 'another-dev-test-flag': true });
    expect(allFlags).not.toHaveProperty('moonshot-demo');
    expect(emitter.emit).toHaveBeenNthCalledWith(3, 'change', context, {
      'dev-test-flag': {
        previous: true,
        current: putResponse['dev-test-flag'].value,
      },
      'another-dev-test-flag': { current: newFlag.value },
      'moonshot-demo': { previous: true },
    });
  });

  test('an update to inExperiment should emit change event', async () => {
    const putResponse = clone<Flags>(defaultPutResponse);
    putResponse['dev-test-flag'].reason = { kind: 'RULE_MATCH', inExperiment: true };

    const allFlags = await identifyGetAllFlags(putResponse);
    const flagsInStorage = JSON.parse(basicPlatform.storage.set.mock.calls[0][1]) as Flags;

    expect(allFlags).toMatchObject({ 'dev-test-flag': true });
    expect(flagsInStorage['dev-test-flag'].reason).toEqual({
      kind: 'RULE_MATCH',
      inExperiment: true,
    });

    // both previous and current are true but inExperiment has changed
    // so a change event should be emitted
    expect(emitter.emit).toHaveBeenNthCalledWith(3, 'change', context, {
      'dev-test-flag': {
        previous: true,
        current: true,
      },
    });
  });

  // TODO: add tests for patch and delete listeners
});
