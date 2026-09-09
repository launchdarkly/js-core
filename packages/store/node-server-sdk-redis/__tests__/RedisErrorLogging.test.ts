import { LDLogger, PersistentDataStoreWrapper } from '@launchdarkly/node-server-sdk';

import RedisCore from '../src/RedisCore';
import RedisFeatureStore from '../src/RedisFeatureStore';

jest.mock('@launchdarkly/node-server-sdk', () => {
  const actual = jest.requireActual('@launchdarkly/node-server-sdk');
  return {
    ...actual,
    PersistentDataStoreWrapper: jest.fn(),
  };
});

function makeLogger(): LDLogger {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('logs at error level when the initialized check fails', (done) => {
  const logger = makeLogger();
  const state = {
    prefixedKey: (key: string) => key,
    getClient: () => ({
      exists: (_key: string, cb: (err: Error | null, count: number) => void) => {
        cb(new Error('connection refused'), 0);
      },
    }),
  };
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state, logger);

  core.initialized((isInitialized) => {
    expect(isInitialized).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'Error reading initialized state from Redis: Error: connection refused',
    );
    done();
  });
});

it('logs through the wrapper when a write fails', (done) => {
  const { PersistentDataStoreWrapper: RealWrapper } = jest.requireActual(
    '@launchdarkly/node-server-sdk',
  );
  const logger = makeLogger();
  const fakeClient = {
    watch: jest.fn(),
    hget: (_ns: string, _key: string, cb: (err: Error | null, val: string | null) => void) => {
      cb(null, null);
    },
    multi: () => ({
      hset: jest.fn(),
      discard: jest.fn(),
      exec: (cb: (err: Error | null, replies: unknown) => void) => {
        cb(new Error('Connection is closed.'), undefined);
      },
    }),
  };
  const state = {
    prefixedKey: (key: string) => key,
    isConnected: () => true,
    isInitialConnection: () => false,
    getClient: () => fakeClient,
    close: jest.fn(),
  };
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state, logger);
  const wrapper = new RealWrapper(core, 0, logger);

  wrapper.upsert({ namespace: 'features' }, { key: 'flagA', version: 5 }, () => {
    expect(logger.error).toHaveBeenCalledWith(
      'Persistent store returned error: Connection is closed.',
    );
    wrapper.close();
    done();
  });
});

it('passes the SDK logger to the persistent store wrapper', () => {
  const logger = makeLogger();
  // Provide a fake client so no real Redis connection is made.
  const fakeClient = { on: jest.fn() };
  const store = new RedisFeatureStore(
    // @ts-ignore Partial client mock for testing.
    { client: fakeClient },
    logger,
  );

  expect(store).toBeDefined();
  const wrapperMock = PersistentDataStoreWrapper as unknown as jest.Mock;
  expect(wrapperMock).toHaveBeenCalledTimes(1);
  expect(wrapperMock.mock.calls[0][2]).toBe(logger);
});
