import { PersistentDataStoreWrapper } from '@launchdarkly/node-server-sdk';

import RedisCore from '../src/RedisCore';
import RedisFeatureStore from '../src/RedisFeatureStore';
import { makeState } from './testUtils';

jest.mock('@launchdarkly/node-server-sdk', () => {
  const actual = jest.requireActual('@launchdarkly/node-server-sdk');
  return {
    ...actual,
    PersistentDataStoreWrapper: jest.fn(),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

it('reports an init error through the callback when the transaction fails', (done) => {
  const state = makeState({
    getClient: () => ({
      multi: () => ({
        del: jest.fn(),
        hmset: jest.fn(),
        set: jest.fn(),
        exec: (cb: (err: Error | null) => void) => cb(new Error('connection refused')),
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);
  core.init([], (err) => {
    expect(err).toEqual(new Error('connection refused'));
    done();
  });
});

it('calls back without an error when init succeeds', (done) => {
  const state = makeState({
    getClient: () => ({
      multi: () => ({
        del: jest.fn(),
        hmset: jest.fn(),
        set: jest.fn(),
        // Success is a reply array. A nil reply means the transaction was aborted.
        exec: (cb: (err: Error | null, replies: unknown) => void) => cb(null, [[null, 'OK']]),
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);
  core.init([], (err) => {
    expect(err).toBeUndefined();
    done();
  });
});

it('reports an init error when the transaction is aborted with a nil reply', (done) => {
  const state = makeState({
    getClient: () => ({
      multi: () => ({
        del: jest.fn(),
        hmset: jest.fn(),
        set: jest.fn(),
        // An EXEC aborted by a watch on the shared connection returns nil with no error.
        // Reporting success here would end a store outage without writing anything.
        exec: (cb: (err: Error | null, replies: unknown) => void) => cb(null, null),
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);
  core.init([], (err) => {
    expect(err).toBeDefined();
    done();
  });
});

it('reports an init error when a committed transaction contains a per-command error', (done) => {
  const commandError = new Error('OOM command not allowed when used memory > maxmemory');
  const state = makeState({
    getClient: () => ({
      multi: () => ({
        del: jest.fn(),
        hmset: jest.fn(),
        set: jest.fn(),
        exec: (cb: (err: Error | null, replies: unknown) => void) =>
          cb(null, [
            [null, 1],
            [commandError, null],
          ]),
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);
  core.init([], (err) => {
    expect(err).toBe(commandError);
    done();
  });
});

it('fails init fast without a transaction when the connection is down', (done) => {
  const state = makeState({
    isConnected: () => false,
    isInitialConnection: () => false,
    getClient: () => {
      throw new Error('should not create a client while disconnected');
    },
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);
  core.init([], (err) => {
    expect(err).toBeDefined();
    done();
  });
});

it('calls back true from isStoreAvailable when the check succeeds', (done) => {
  const state = makeState({
    getClient: () => ({
      exists: (_key: string, cb: (err: Error | null, count: number) => void) => cb(null, 0),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);
  core.isStoreAvailable((isAvailable) => {
    expect(isAvailable).toBe(true);
    done();
  });
});

it('calls back false from isStoreAvailable when the check fails', (done) => {
  const state = makeState({
    getClient: () => ({
      exists: (_key: string, cb: (err: Error | null, count: number) => void) =>
        cb(new Error('connection refused'), 0),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);
  core.isStoreAvailable((isAvailable) => {
    expect(isAvailable).toBe(false);
    done();
  });
});

it('calls back false from isStoreAvailable when the connection is down', (done) => {
  const state = makeState({
    isConnected: () => false,
    isInitialConnection: () => false,
    getClient: () => {
      throw new Error('should not create a client while disconnected');
    },
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);
  core.isStoreAvailable((isAvailable) => {
    expect(isAvailable).toBe(false);
    done();
  });
});

it('forwards isStoreAvailable through the feature store facade', (done) => {
  const wrapperProbe = jest.fn((callback: (isAvailable: boolean) => void) => callback(true));
  (PersistentDataStoreWrapper as unknown as jest.Mock).mockImplementation(() => ({
    isStoreAvailable: wrapperProbe,
  }));
  // Provide a fake client so no real Redis connection is made.
  const fakeClient = { on: jest.fn() };
  const store = new RedisFeatureStore(
    // @ts-ignore Partial client mock for testing.
    { client: fakeClient },
  );
  store.isStoreAvailable((isAvailable) => {
    expect(isAvailable).toBe(true);
    // The answer must come from the wrapper, not from a facade fallback.
    expect(wrapperProbe).toHaveBeenCalledTimes(1);
    done();
  });
});
