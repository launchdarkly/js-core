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
      'Error reading initialized state from Redis Error: connection refused',
    );
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
