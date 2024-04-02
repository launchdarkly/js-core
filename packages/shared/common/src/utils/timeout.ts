/**
 * Returns a promise which errors after t seconds.
 *
 * @param t Timeout in seconds.
 * @param error Throw this error when when time is up. Should be a meaningful
 * description of what task has timed out to aid debugging.
 */
const timeout = (t: number, error?: string) =>
  new Promise<void>((_res, reject) => {
    setTimeout(() => reject(new Error(error ?? `Timed out after ${t} seconds.`)), t * 1000);
  });

export default timeout;
