import { LDLogger } from '../api';

/**
 * Returns a promise which errors after t seconds.
 *
 * @param t Timeout in seconds.
 * @param taskName Name of task being timed for logging and error reporting.
 * @param logger {@link LDLogger} object.
 */
const timeout = (t: number, taskName: string, logger?: LDLogger) =>
  new Promise<void>((_res, reject) => {
    setTimeout(() => {
      const e = `${taskName} timed out after ${t} seconds.`;
      logger?.error(e);
      reject(new Error(e));
    }, t * 1000);
  });

export default timeout;
