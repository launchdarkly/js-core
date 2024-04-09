/**
 * Returns a promise which errors after t seconds.
 *
 * @param t Timeout in seconds.
 * @param taskName Name of task being timed for logging and error reporting.
 */
const timedPromise = (t: number, taskName: string) =>
  new Promise<void>((_res, reject) => {
    setTimeout(() => {
      const e = `${taskName} timed out after ${t} seconds.`;
      reject(new Error(e));
    }, t * 1000);
  });

export default timedPromise;
