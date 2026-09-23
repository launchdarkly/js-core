import { interfaces } from '@launchdarkly/node-server-sdk';

import RedisCore from '../src/RedisCore';
import { expectNoUnhandledRejection } from './testUtils';

const featuresKind = { namespace: 'features', deserialize: (data: string) => JSON.parse(data) };

function makeState(overrides: object) {
  return {
    prefixedKey: (key: string) => key,
    isConnected: () => true,
    isInitialConnection: () => false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('reports an error through the callback when watch rejects, with no unhandled rejection', async () => {
  const watchError = new Error('connection is closed.');
  const state = makeState({
    getClient: () => ({
      watch: () => Promise.reject(watchError),
      // The get() call reads via hget; leaving it uncalled isolates the
      // watch-rejection path so the callback observed below only comes from it.
      hget: jest.fn(),
      multi: () => ({
        discard: jest.fn(),
        hset: jest.fn(),
        exec: jest.fn(),
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);

  const result = await expectNoUnhandledRejection(
    () =>
      new Promise<{
        err?: Error;
        updated?: interfaces.SerializedItemDescriptor;
      }>((resolve) => {
        core.upsert(featuresKind, 'flagA', { version: 1, serializedItem: '{}' }, (err, updated) => {
          resolve({ err, updated });
        });
      }),
  );

  expect(result.err).toBe(watchError);
  expect(result.updated).toBeUndefined();
});

it('settles the callback exactly once when watch rejects and exec also errors', async () => {
  const watchError = new Error('watch: connection is closed.');
  const execError = new Error('exec: connection is closed.');
  const state = makeState({
    getClient: () => ({
      watch: () => Promise.reject(watchError),
      hget: (_ns: string, _key: string, cb: (err: Error | null, val: string | null) => void) => {
        cb(null, null);
      },
      multi: () => ({
        hset: jest.fn(),
        discard: jest.fn(),
        exec: (cb: (err: Error | null, replies: unknown) => void) => {
          cb(execError, undefined);
        },
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);

  const callback = jest.fn();
  // The helper's event-loop turn also lets the watch rejection's handler run after
  // exec's synchronous callback has already settled the upsert.
  await expectNoUnhandledRejection(async () => {
    core.upsert(featuresKind, 'flagA', { version: 1, serializedItem: '{}' }, callback);
  });

  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(execError, { version: 1, serializedItem: '{}' });
});

it('stores the serializedItem verbatim for a deleted descriptor', (done) => {
  const hset = jest.fn();
  const serializedItem = JSON.stringify({ key: 'flagA', version: 3, deleted: true });
  const state = makeState({
    getClient: () => ({
      watch: jest.fn().mockResolvedValue('OK'),
      hget: (_ns: string, _key: string, cb: (err: Error | null, val: string | null) => void) => {
        cb(null, null);
      },
      multi: () => ({
        hset,
        discard: jest.fn(),
        exec: (cb: (err: Error | null, replies: unknown) => void) => {
          cb(null, ['OK']);
        },
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);

  core.upsert(featuresKind, 'flagA', { version: 3, deleted: true, serializedItem }, () => {
    expect(hset).toHaveBeenCalledWith('features', 'flagA', serializedItem);
    done();
  });
});
