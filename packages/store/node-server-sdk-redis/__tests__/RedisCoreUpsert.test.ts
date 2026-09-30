import { interfaces } from '@launchdarkly/node-server-sdk';

import RedisCore from '../src/RedisCore';
import { flushRejections, makeState } from './testUtils';

const featuresKind = { namespace: 'features', deserialize: (data: string) => JSON.parse(data) };

// An assertion inside an upsert callback throws into the promise chain, where the
// error handler swallows it and the test times out with no message. Capture the
// result here and assert in the test body instead.
function upsertResult(
  core: RedisCore,
  descriptor: interfaces.SerializedItemDescriptor,
): Promise<{ err?: Error; updated?: interfaces.SerializedItemDescriptor }> {
  return new Promise((resolve) => {
    core.upsert(featuresKind, 'flagA', descriptor, (err, updated) => {
      resolve({ err, updated });
    });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('reports an error through the callback when watch rejects, with no unhandled rejection', async () => {
  const watchError = new Error('connection is closed.');
  const state = makeState({
    getClient: () => ({
      watch: () => Promise.reject(watchError),
      unwatch: jest.fn().mockResolvedValue('OK'),
      hget: jest.fn(),
      multi: () => ({
        hset: jest.fn(),
        exec: jest.fn(),
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);

  const result = await flushRejections(() =>
    upsertResult(core, { version: 1, serializedItem: '{}' }),
  );

  expect(result.err).toBe(watchError);
  expect(result.updated).toBeUndefined();
});

it('does not read or run the transaction when watch rejects', async () => {
  const watchError = new Error('connection is closed.');
  // Both mocks respond immediately, so this attempt would commit if it were not
  // abandoned. A commit after a failed watch could clear the watch of the next
  // queued update on the shared connection.
  const hget = jest.fn(
    (_ns: string, _key: string, cb: (err: Error | null, val: string | null) => void) => {
      cb(null, null);
    },
  );
  const exec = jest.fn((cb: (err: Error | null, replies: unknown) => void) => {
    cb(null, [[null, 1]]);
  });
  const state = makeState({
    getClient: () => ({
      watch: () => Promise.reject(watchError),
      unwatch: jest.fn().mockResolvedValue('OK'),
      hget,
      multi: () => ({
        hset: jest.fn(),
        exec,
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);

  const callback = jest.fn();
  // The helper's event-loop turn lets the watch rejection propagate through the chain.
  await flushRejections(async () => {
    core.upsert(featuresKind, 'flagA', { version: 1, serializedItem: '{}' }, callback);
  });

  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(watchError, undefined);
  expect(hget).not.toHaveBeenCalled();
  expect(exec).not.toHaveBeenCalled();
});

it('stores the serializedItem verbatim for a deleted descriptor', async () => {
  const hset = jest.fn();
  // The property order differs from the placeholder the code can build itself, so this
  // value only matches when the write is verbatim.
  const serializedItem = '{"version":3,"deleted":true,"key":"flagA"}';
  const state = makeState({
    getClient: () => ({
      watch: jest.fn().mockResolvedValue('OK'),
      unwatch: jest.fn().mockResolvedValue('OK'),
      hget: (_ns: string, _key: string, cb: (err: Error | null, val: string | null) => void) => {
        cb(null, null);
      },
      multi: () => ({
        hset,
        exec: (cb: (err: Error | null, replies: unknown) => void) => {
          cb(null, [[null, 1]]);
        },
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);

  const result = await upsertResult(core, { version: 3, deleted: true, serializedItem });

  expect(result.err).toBeUndefined();
  expect(hset).toHaveBeenCalledWith('features', 'flagA', serializedItem);
});

it('sends UNWATCH and does not run the transaction when the stored version is newer', async () => {
  const unwatch = jest.fn().mockResolvedValue('OK');
  const exec = jest.fn();
  const state = makeState({
    getClient: () => ({
      watch: jest.fn().mockResolvedValue('OK'),
      unwatch,
      hget: (_ns: string, _key: string, cb: (err: Error | null, val: string | null) => void) => {
        cb(null, JSON.stringify({ key: 'flagA', version: 5 }));
      },
      multi: () => ({
        hset: jest.fn(),
        exec,
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);

  const result = await upsertResult(core, { version: 3, serializedItem: '{}' });

  expect(result.err).toBeUndefined();
  expect(result.updated?.version).toEqual(5);
  // A client-side discard would leave the watch armed on the shared connection, and
  // the next transaction on it could be silently aborted.
  expect(unwatch).toHaveBeenCalledTimes(1);
  expect(exec).not.toHaveBeenCalled();
});

it('sends UNWATCH and reports no update when the descriptor has no data', async () => {
  const unwatch = jest.fn().mockResolvedValue('OK');
  const exec = jest.fn();
  const state = makeState({
    getClient: () => ({
      watch: jest.fn().mockResolvedValue('OK'),
      unwatch,
      hget: (_ns: string, _key: string, cb: (err: Error | null, val: string | null) => void) => {
        cb(null, null);
      },
      multi: () => ({
        hset: jest.fn(),
        exec,
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);

  // Not deleted and no serializedItem violates the SDK contract. The attempt must
  // still release its watch.
  const result = await upsertResult(core, { version: 2, deleted: false });

  expect(result.err).toBeUndefined();
  expect(result.updated).toBeUndefined();
  expect(unwatch).toHaveBeenCalledTimes(1);
  expect(exec).not.toHaveBeenCalled();
});

it('reports a read error and sends UNWATCH without writing', async () => {
  const readError = new Error('read failed');
  const unwatch = jest.fn().mockResolvedValue('OK');
  const hset = jest.fn();
  const exec = jest.fn();
  const state = makeState({
    getClient: () => ({
      watch: jest.fn().mockResolvedValue('OK'),
      unwatch,
      hget: (_ns: string, _key: string, cb: (err: Error | null, val: string | null) => void) => {
        cb(readError, null);
      },
      multi: () => ({
        hset,
        exec,
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);

  // A read failure must not be treated as a missing item. That would skip the version
  // check and let an older item overwrite a newer one.
  const result = await upsertResult(core, { version: 2, serializedItem: '{}' });

  expect(result.err).toBe(readError);
  expect(result.updated).toBeUndefined();
  expect(unwatch).toHaveBeenCalledTimes(1);
  expect(hset).not.toHaveBeenCalled();
  expect(exec).not.toHaveBeenCalled();
});

it('overwrites a malformed stored item instead of throwing', async () => {
  const hset = jest.fn();
  const state = makeState({
    getClient: () => ({
      watch: jest.fn().mockResolvedValue('OK'),
      unwatch: jest.fn().mockResolvedValue('OK'),
      hget: (_ns: string, _key: string, cb: (err: Error | null, val: string | null) => void) => {
        // Not valid JSON, so deserialize throws.
        cb(null, 'garbage');
      },
      multi: () => ({
        hset,
        exec: (cb: (err: Error | null, replies: unknown) => void) => {
          cb(null, [[null, 1]]);
        },
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);

  // A throw inside the redis client callback would crash the process.
  const result = await upsertResult(core, { version: 2, serializedItem: '{}' });

  expect(result.err).toBeUndefined();
  expect(hset).toHaveBeenCalledWith('features', 'flagA', '{}');
});

it('reports an error when a committed transaction contains a per-command error', async () => {
  const commandError = new Error(
    'WRONGTYPE Operation against a key holding the wrong kind of value',
  );
  const state = makeState({
    getClient: () => ({
      watch: jest.fn().mockResolvedValue('OK'),
      unwatch: jest.fn().mockResolvedValue('OK'),
      hget: (_ns: string, _key: string, cb: (err: Error | null, val: string | null) => void) => {
        cb(null, null);
      },
      multi: () => ({
        hset: jest.fn(),
        exec: (cb: (err: Error | null, replies: unknown) => void) => {
          cb(null, [[commandError, null]]);
        },
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);

  const result = await upsertResult(core, { version: 2, serializedItem: '{}' });

  expect(result.err).toBe(commandError);
});

it('retries when the transaction is aborted by a concurrent modification', async () => {
  const exec = jest
    .fn()
    // A nil reply means the watched key changed and the EXEC was aborted.
    .mockImplementationOnce((cb: (err: Error | null, replies: unknown) => void) => {
      cb(null, null);
    })
    .mockImplementationOnce((cb: (err: Error | null, replies: unknown) => void) => {
      cb(null, [[null, 1]]);
    });
  const state = makeState({
    getClient: () => ({
      watch: jest.fn().mockResolvedValue('OK'),
      unwatch: jest.fn().mockResolvedValue('OK'),
      hget: (_ns: string, _key: string, cb: (err: Error | null, val: string | null) => void) => {
        cb(null, null);
      },
      multi: () => ({
        hset: jest.fn(),
        exec,
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);

  const result = await upsertResult(core, { version: 2, serializedItem: '{}' });

  expect(result.err).toBeUndefined();
  expect(result.updated).toEqual({ version: 2, serializedItem: '{}' });
  expect(exec).toHaveBeenCalledTimes(2);
});

it('fails fast without watching when the connection is down', async () => {
  const watch = jest.fn();
  const state = makeState({
    isConnected: () => false,
    isInitialConnection: () => false,
    getClient: () => ({
      watch,
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);

  const result = await upsertResult(core, { version: 2, serializedItem: '{}' });

  expect(result.err?.message).toEqual('Redis connection is down');
  expect(watch).not.toHaveBeenCalled();
});
