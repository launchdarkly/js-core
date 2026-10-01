import { interfaces } from '@launchdarkly/node-server-sdk';

import RedisCore from '../src/RedisCore';
import { fakeWatchPipeline, flushRejections, makeState } from './testUtils';

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

function watchOkRead(storedItem: string | null) {
  return fakeWatchPipeline(async () => [
    [null, 'OK'],
    [null, storedItem],
  ]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('reports an error through the callback when the watch reply is an error, with no unhandled rejection', async () => {
  const watchError = new Error('connection is closed.');
  const state = makeState({
    getClient: () => ({
      pipeline: fakeWatchPipeline(async () => [[watchError], [null, null]]),
      unwatch: jest.fn().mockResolvedValue('OK'),
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

it('does not run the transaction when the watch fails', async () => {
  const watchError = new Error('connection is closed.');
  // The mock would commit if the attempt were not abandoned. A commit after a failed
  // watch could clear the watch of the next queued update on the shared connection.
  const exec = jest.fn((cb: (err: Error | null, replies: unknown) => void) => {
    cb(null, [[null, 1]]);
  });
  const state = makeState({
    getClient: () => ({
      pipeline: fakeWatchPipeline(async () => [[watchError], [null, null]]),
      unwatch: jest.fn().mockResolvedValue('OK'),
      multi: () => ({
        hset: jest.fn(),
        exec,
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);

  const callback = jest.fn();
  // The helper's event-loop turn lets the watch failure propagate through the chain.
  await flushRejections(async () => {
    core.upsert(featuresKind, 'flagA', { version: 1, serializedItem: '{}' }, callback);
  });

  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(watchError, undefined);
  expect(exec).not.toHaveBeenCalled();
});

it('reports an error through the callback when the watch pipeline rejects', async () => {
  const pipelineError = new Error('Connection is closed.');
  const state = makeState({
    getClient: () => ({
      pipeline: fakeWatchPipeline(() => Promise.reject(pipelineError)),
      unwatch: jest.fn().mockResolvedValue('OK'),
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

  expect(result.err).toBe(pipelineError);
  expect(result.updated).toBeUndefined();
});

it('stores the serializedItem verbatim for a deleted descriptor', async () => {
  const hset = jest.fn();
  // The property order differs from the placeholder the code can build itself, so this
  // value only matches when the write is verbatim.
  const serializedItem = '{"version":3,"deleted":true,"key":"flagA"}';
  const state = makeState({
    getClient: () => ({
      pipeline: watchOkRead(null),
      unwatch: jest.fn().mockResolvedValue('OK'),
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
      pipeline: watchOkRead(JSON.stringify({ key: 'flagA', version: 5 })),
      unwatch,
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
      pipeline: watchOkRead(null),
      unwatch,
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
      pipeline: fakeWatchPipeline(async () => [[null, 'OK'], [readError]]),
      unwatch,
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

it('sends UNWATCH when the pipeline reply is incomplete after a successful watch', async () => {
  const unwatch = jest.fn().mockResolvedValue('OK');
  const exec = jest.fn();
  const state = makeState({
    getClient: () => ({
      // The watch succeeded but the read reply is missing, so the handler throws
      // into the catch path with the watch armed on the server.
      pipeline: fakeWatchPipeline(async () => [[null, 'OK']]),
      unwatch,
      multi: () => ({
        hset: jest.fn(),
        exec,
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);

  const result = await flushRejections(() =>
    upsertResult(core, { version: 2, serializedItem: '{}' }),
  );

  expect(result.err?.message).toEqual('The Redis watch pipeline returned no reply');
  // A stale watch on the shared connection could abort the next update's EXEC.
  expect(unwatch).toHaveBeenCalledTimes(1);
  expect(exec).not.toHaveBeenCalled();
});

it('overwrites a malformed stored item instead of throwing', async () => {
  const hset = jest.fn();
  const state = makeState({
    getClient: () => ({
      // Not valid JSON, so deserialize throws.
      pipeline: watchOkRead('garbage'),
      unwatch: jest.fn().mockResolvedValue('OK'),
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

  // A deserialize throw must settle as an overwrite, never crash or hang.
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
      pipeline: watchOkRead(null),
      unwatch: jest.fn().mockResolvedValue('OK'),
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

it('retries exactly once when the transaction is aborted by a concurrent modification', async () => {
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
      pipeline: watchOkRead(null),
      unwatch: jest.fn().mockResolvedValue('OK'),
      multi: () => ({
        hset: jest.fn(),
        exec,
      }),
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);

  const callback = jest.fn();
  await new Promise<void>((resolve) => {
    callback.mockImplementationOnce(() => resolve());
    core.upsert(featuresKind, 'flagA', { version: 2, serializedItem: '{}' }, callback);
  });
  // Give a duplicate settle from the aborted attempt the chance to fire before counting.
  await new Promise((resolve) => {
    setImmediate(resolve);
  });

  // A second fire would shift the persistent store wrapper's queue twice and drop an update.
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(undefined, { version: 2, serializedItem: '{}' });
  expect(exec).toHaveBeenCalledTimes(2);
});

it('fails fast without watching when the connection has been down longer than the grace period', async () => {
  const pipeline = jest.fn();
  const state = makeState({
    isConnected: () => false,
    isInitialConnection: () => false,
    disconnectedForMs: () => 60_000,
    getClient: () => ({
      pipeline,
    }),
  });
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state);

  const result = await upsertResult(core, { version: 2, serializedItem: '{}' });

  expect(result.err?.message).toEqual('Redis connection is down');
  expect(pipeline).not.toHaveBeenCalled();
});

it('sends an upsert to the client while the connection drop is within the grace period', async () => {
  // A write issued during a short drop must reach ioredis, which queues it and sends it
  // when the connection returns. Failing fast here would drop the write, and an SDK that
  // evaluates from the store would then serve stale data until the next full data set.
  const exec = jest.fn((cb: (err: Error | null, replies: unknown) => void) => {
    cb(null, [[null, 1]]);
  });
  const state = makeState({
    isConnected: () => false,
    isInitialConnection: () => false,
    disconnectedForMs: () => 1_000,
    getClient: () => ({
      pipeline: watchOkRead(null),
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
  expect(exec).toHaveBeenCalledTimes(1);
});
