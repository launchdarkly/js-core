import { LDLogger } from '@launchdarkly/js-sdk-common';

import { createAsyncQueue } from './AsyncQueue';
import { FDv2Requestor } from './FDv2Requestor';
import { FDv2SourceResult, shutdown } from './FDv2SourceResult';
import { poll } from './PollingBase';
import { Synchronizer } from './Synchronizer';

/**
 * Creates a continuous polling synchronizer that periodically polls for FDv2
 * data and yields results via successive calls to `next()`.
 *
 * The first poll fires immediately. Subsequent polls are scheduled using
 * `setTimeout` after each poll completes, ensuring sequential execution and
 * preventing overlapping requests on slow networks.
 *
 * Results are buffered in an async queue. On terminal errors, polling stops
 * and the shutdown future is resolved. On `close()`, polling stops and the
 * next `next()` call returns a shutdown result.
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
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  async function doPoll(): Promise<void> {
    if (stopped) {
      return;
    }

    const startTime = Date.now();
    try {
      const result = await poll(requestor, selectorGetter(), false, logger);

      if (stopped) {
        return;
      }

      let shouldShutdown = false;

      if (result.type === 'status') {
        switch (result.state) {
          case 'terminal_error':
            stopped = true;
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

    // Schedule next poll after completion, accounting for elapsed time.
    // This ensures sequential execution — no overlapping requests.
    if (!stopped) {
      const sleepFor = Math.max(pollIntervalMs - (Date.now() - startTime), 0);
      timeoutHandle = setTimeout(() => {
        doPoll();
      }, sleepFor);
    }
  }

  // Start polling immediately
  doPoll();

  return {
    async next(): Promise<FDv2SourceResult> {
      return Promise.race([shutdownPromise, resultQueue.take()]);
    },

    close(): void {
      stopped = true;
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
        timeoutHandle = undefined;
      }
      shutdownResolve?.(shutdown());
      shutdownResolve = undefined;
    },
  };
}
