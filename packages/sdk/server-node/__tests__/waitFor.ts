/**
 * Resolves after the given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Polls a condition until it holds or the timeout elapses.
 */
export default async function waitFor(
  condition: () => Promise<boolean> | boolean,
  timeoutMs: number = 5000,
  intervalMs: number = 20,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    if (await condition()) {
      return;
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(intervalMs);
  }
  throw new Error('timed out waiting for the condition');
}
