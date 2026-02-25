import { LDLogger } from '@launchdarkly/js-sdk-common';

import { FDv2Requestor } from './FDv2Requestor';
import { FDv2SourceResult, shutdown } from './FDv2SourceResult';
import { poll } from './PollingBase';
import { Synchronizer } from './Synchronizer';

/**
 * A minimal async queue for buffering poll results between the timer
 * (producer) and `next()` calls (consumer).
 */
interface AsyncQueue<T> {
  put(item: T): void;
  take(): Promise<T>;
}

function createAsyncQueue<T>(): AsyncQueue<T> {
  const items: T[] = [];
  let waiter: ((item: T) => void) | undefined;

  return {
    put(item: T): void {
      if (waiter) {
        const resolve = waiter;
        waiter = undefined;
        resolve(item);
      } else {
        items.push(item);
      }
    },

    take(): Promise<T> {
      if (items.length > 0) {
        return Promise.resolve(items.shift()!);
      }
      return new Promise<T>((resolve) => {
        waiter = resolve;
      });
    },
  };
}

function stopTimer(handle: ReturnType<typeof setInterval> | undefined) {
  if (handle !== undefined) {
    clearInterval(handle);
  }
}

/**
 * Creates a continuous polling synchronizer that periodically polls for FDv2
 * data and yields results via successive calls to `next()`.
 *
 * The polling timer starts immediately on creation. Results are buffered in
 * an async queue. On terminal errors, the timer is cancelled and the shutdown
 * future is resolved. On `close()`, the timer is cancelled and the next
 * `next()` call returns a shutdown result.
 *
 * @internal
 */
export function createPollingSynchronizer(
  requestor: FDv2Requestor,
  logger: LDLogger | undefined,
  selectorGetter: () => string | undefined,
  pollIntervalMs: number,
): Synchronizer {
  const resultQueue = createAsyncQueue<FDv2SourceResult>();
  let shutdownResolve: ((result: FDv2SourceResult) => void) | undefined;
  const shutdownPromise = new Promise<FDv2SourceResult>((resolve) => {
    shutdownResolve = resolve;
  });
  let timerHandle: ReturnType<typeof setInterval> | undefined;

  async function doPoll(): Promise<void> {
    try {
      const result = await poll(requestor, selectorGetter(), false, logger);

      let shouldShutdown = false;

      if (result.type === 'status') {
        switch (result.state) {
          case 'terminal_error':
            stopTimer(timerHandle);
            timerHandle = undefined;
            shouldShutdown = true;
            break;
          case 'interrupted':
          case 'goodbye':
            // Continue polling on transient errors and goodbyes
            break;
          case 'shutdown':
            // The base poll function doesn't emit shutdown; we handle it
            // at this level via close().
            break;
          default:
            break;
        }
      }

      if (shouldShutdown) {
        shutdownResolve?.(result);
        shutdownResolve = undefined;
      } else {
        resultQueue.put(result);
      }
    } catch (err) {
      logger?.debug(`Polling error: ${err}`);
    }
  }

  // Start polling immediately and then at regular intervals
  doPoll();
  timerHandle = setInterval(() => {
    doPoll();
  }, pollIntervalMs);

  return {
    async next(): Promise<FDv2SourceResult> {
      return Promise.race([shutdownPromise, resultQueue.take()]);
    },

    close(): void {
      stopTimer(timerHandle);
      timerHandle = undefined;
      shutdownResolve?.(shutdown());
      shutdownResolve = undefined;
    },
  };
}
