import { AutoEnvAttributes, clone, type LDContext, LDLogger } from '@launchdarkly/js-sdk-common';

import LDClientImpl from '../src/LDClientImpl';
import { Flags } from '../src/types';
import { createBasicPlatform } from './createBasicPlatform';
import mockResponseJson from './evaluation/mockResponse.json';
import { makeTestDataManagerFactory } from './TestDataManager';

const testSdkKey = 'test-sdk-key';
const context: LDContext = { kind: 'org', key: 'Testy Pizza' };
const flagStorageKey = 'LaunchDarkly_1234567890123456_1234567890123456';

let mockPlatform: ReturnType<typeof createBasicPlatform>;
let logger: LDLogger;

function makeClient(options: { disableCache?: boolean } = {}) {
  return new LDClientImpl(
    testSdkKey,
    AutoEnvAttributes.Disabled,
    mockPlatform,
    { logger, sendEvents: false, ...options },
    makeTestDataManagerFactory(testSdkKey, mockPlatform, { disableNetwork: true }),
  );
}

function storeFlags(flags: Flags | undefined) {
  (mockPlatform.storage.get as jest.Mock).mockImplementation((key: string) =>
    key === flagStorageKey && flags ? JSON.stringify(flags) : undefined,
  );
}

beforeEach(() => {
  mockPlatform = createBasicPlatform();
  logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
});

afterEach(() => {
  jest.resetAllMocks();
});

it('emits cacheLoaded with a hit when cached flags are found', async () => {
  storeFlags(clone<Flags>(mockResponseJson));
  const ldc = makeClient();
  const listener = jest.fn();
  ldc.on('cacheLoaded', listener);

  await ldc.identify(context);

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith(context, { hit: true });
});

it('emits cacheLoaded with a miss when no cached flags are found', async () => {
  storeFlags(undefined);
  const ldc = makeClient();
  const listener = jest.fn();
  ldc.on('cacheLoaded', listener);

  await ldc.identify(context);

  expect(listener).toHaveBeenCalledWith(context, { hit: false });
});

it('emits cacheLoaded with a miss when the cache is disabled', async () => {
  storeFlags(clone<Flags>(mockResponseJson));
  const ldc = makeClient({ disableCache: true });
  const listener = jest.fn();
  ldc.on('cacheLoaded', listener);

  await ldc.identify(context);

  expect(listener).toHaveBeenCalledWith(context, { hit: false });
});

it('resolves waitForCache when called before identify', async () => {
  storeFlags(clone<Flags>(mockResponseJson));
  const ldc = makeClient();

  const cachePromise = ldc.waitForCache();
  await ldc.identify(context);

  await expect(cachePromise).resolves.toEqual({ hit: true });
});

it('resolves waitForCache with the last result when called after the lookup', async () => {
  storeFlags(undefined);
  const ldc = makeClient();
  await ldc.identify(context);

  await expect(ldc.waitForCache()).resolves.toEqual({ hit: false });
});

it('resolves waitForCache with the result for the latest identify', async () => {
  storeFlags(undefined);
  const ldc = makeClient();
  await ldc.identify(context);

  storeFlags(clone<Flags>(mockResponseJson));
  await ldc.identify(context);

  await expect(ldc.waitForCache()).resolves.toEqual({ hit: true });
});

it('resolves waitForCache with a miss when identify completes without a cache lookup', async () => {
  const ldc = new LDClientImpl(
    testSdkKey,
    AutoEnvAttributes.Disabled,
    mockPlatform,
    { logger, sendEvents: false },
    () => ({
      identify: async (identifyResolve) => identifyResolve(),
      close: () => {},
    }),
  );
  const listener = jest.fn();
  ldc.on('cacheLoaded', listener);

  const cachePromise = ldc.waitForCache();
  await ldc.identify(context);

  await expect(cachePromise).resolves.toEqual({ hit: false });
  expect(listener).not.toHaveBeenCalled();
});

it('resolves waitForCache with a miss when identify fails on an invalid context', async () => {
  const ldc = makeClient();
  const cachePromise = ldc.waitForCache();

  // @ts-expect-error - invalid context
  await expect(ldc.identify({ kind: 'car' })).rejects.toThrow(/no key/);

  await expect(cachePromise).resolves.toEqual({ hit: false });
});

it('resolves waitForCache with a miss when identify fails before it runs', async () => {
  (mockPlatform.storage.get as jest.Mock).mockRejectedValue(new Error('storage failed'));
  const ldc = makeClient();
  const cachePromise = ldc.waitForCache();

  await expect(ldc.identify({ kind: 'org', anonymous: true })).rejects.toThrow(/storage failed/);

  await expect(cachePromise).resolves.toEqual({ hit: false });
});

it('does not resolve waitForCache with the previous result while a new identify is pending', async () => {
  storeFlags(clone<Flags>(mockResponseJson));
  const ldc = makeClient();
  await ldc.identify(context);

  storeFlags(undefined);
  const identifyPromise = ldc.identify(context);
  const cachePromise = ldc.waitForCache();
  await identifyPromise;

  await expect(cachePromise).resolves.toEqual({ hit: false });
});

it('ignores the result of an earlier identify that finishes after a later identify call', async () => {
  storeFlags(clone<Flags>(mockResponseJson));
  const ldc = makeClient();

  // @ts-expect-error - invalid context
  const failedIdentify = ldc.identify({ kind: 'car' });
  const secondIdentify = ldc.identify(context);
  const cachePromise = ldc.waitForCache();
  await expect(failedIdentify).rejects.toThrow(/no key/);
  await secondIdentify;

  await expect(cachePromise).resolves.toEqual({ hit: true });
});
