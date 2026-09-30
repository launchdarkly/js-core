/**
 * Build a partial RedisClientState for tests that only need a client and a prefix.
 */
export function makeState(overrides: object) {
  return {
    prefixedKey: (key: string) => key,
    isConnected: () => true,
    isInitialConnection: () => false,
    ...overrides,
  };
}

/**
 * Build a fake `client.pipeline()` factory. The chained WATCH and HGET settle with the
 * given exec result, e.g. `async () => [[null, 'OK'], [null, storedItem]]` for success.
 * Real ioredis reports a per-command error as a one-element `[err]` entry.
 */
export function fakeWatchPipeline(exec: () => Promise<unknown>) {
  const pipeline = { exec } as {
    watch: () => typeof pipeline;
    hget: () => typeof pipeline;
    exec: () => Promise<unknown>;
  };
  pipeline.watch = () => pipeline;
  pipeline.hget = () => pipeline;
  return () => pipeline;
}

/**
 * Run the body, then give the event loop one turn.
 *
 * Jest (jest-circus) installs its own unhandledRejection handler on the real process object
 * and fails the test when a rejection fires. A listener added here would go on the sandboxed
 * `process` and never run, so this helper does not try to detect rejections itself. The extra
 * turn only makes sure a rejection from the body surfaces while the test is still running.
 */
export async function flushRejections<T>(body: () => Promise<T>): Promise<T> {
  const result = await body();
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
  return result;
}
