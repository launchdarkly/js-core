import { PersistentDataStoreWrapper } from '@launchdarkly/node-server-sdk';

import RedisCore from '../src/RedisCore';
import RedisFeatureStore from '../src/RedisFeatureStore';

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

function makeState(overrides: object) {
  return {
    prefixedKey: (key: string) => key,
    isConnected: () => true,
    isInitialConnection: () => false,
    ...overrides,
  };
}

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
        exec: (cb: (err: Error | null) => void) => cb(null),
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
  (PersistentDataStoreWrapper as unknown as jest.Mock).mockImplementation(() => ({
    isStoreAvailable: (callback: (isAvailable: boolean) => void) => callback(true),
  }));
  // Provide a fake client so no real Redis connection is made.
  const fakeClient = { on: jest.fn() };
  const store = new RedisFeatureStore(
    // @ts-ignore Partial client mock for testing.
    { client: fakeClient },
  );
  store.isStoreAvailable((isAvailable) => {
    expect(isAvailable).toBe(true);
    done();
  });
});
