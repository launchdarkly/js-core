import { LDTimeoutError } from '../errors';
import { VoidFunction } from './VoidFunction';

/**
 * Represents a timeout that can be cancelled.
 *
 * When racing a timeout, and another task completes before the timeout,
 * then the timeout should be cancelled. This prevents leaving open handles
 * which can stop the runtime from exiting.
 */
export interface CancelableTimeout {
  promise: Promise<void>;
  cancel: VoidFunction;
}

/**
 * Returns a promise which errors after t seconds.
 *
 * @param t Timeout in seconds.
 * @param taskName Name of task being timed for logging and error reporting.
 */
export function cancelableTimedPromise(t: number, taskName: string): CancelableTimeout {
  let timeout: ReturnType<typeof setTimeout>;
  let resolve: VoidFunction;
  const promise = new Promise<void>((_res, reject) => {
    resolve = _res;
    timeout = setTimeout(() => {
      const e = `${taskName} timed out after ${t} seconds.`;
      reject(new LDTimeoutError(e));
    }, t * 1000);
  });
  return {
    promise,
    cancel: () => {
      resolve();
      clearTimeout(timeout);
    },
  };
}
