import { open } from 'node:fs/promises';

import { sleep } from '@launchdarkly/js-server-sdk-common';

/**
 * Rewrites a file in place the slow way: it truncates the file, waits, and then writes the new
 * content, so a reader can find the file empty in between. Applications and editors rewrite data
 * files in place, and the SDK must tolerate reading one while it is being written.
 */
export async function rewriteInPlace(
  path: string,
  content: string,
  pauseAfterTruncatingMs: number,
): Promise<void> {
  const handle = await open(path, 'r+');
  try {
    await handle.truncate(0);
    await sleep(pauseAfterTruncatingMs);
    await handle.write(content, 0);
  } finally {
    await handle.close();
  }
}

/**
 * Evaluates over and over, and records each value that differs from the one before, until
 * stopped.
 */
export function sampleValues(evaluate: () => Promise<unknown>): {
  served: unknown[];
  stop: () => Promise<void>;
} {
  const served: unknown[] = [];
  let stopped = false;
  const sampling = (async () => {
    while (!stopped) {
      // eslint-disable-next-line no-await-in-loop
      const value = await evaluate();
      if (served.length === 0 || served[served.length - 1] !== value) {
        served.push(value);
      }
      // eslint-disable-next-line no-await-in-loop
      await sleep(2);
    }
  })();
  return {
    served,
    stop: async () => {
      stopped = true;
      await sampling;
    },
  };
}
