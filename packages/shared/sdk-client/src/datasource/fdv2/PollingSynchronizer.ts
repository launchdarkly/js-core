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

/**
 * A continuous polling synchronizer that periodically polls for FDv2 data
 * and yields results via successive calls to `next()`.
 *
 * The polling timer starts immediately on construction. Results are buffered
 * in an async queue. On terminal errors, the timer is cancelled and the
 * shutdown future is resolved. On `close()`, the timer is cancelled and the
 * next `next()` call returns a shutdown result.
 *
 * @internal
 */
export class PollingSynchronizer implements Synchronizer {
  private _shutdownResolve?: (result: FDv2SourceResult) => void;
  private readonly _shutdownPromise: Promise<FDv2SourceResult>;
  private readonly _resultQueue: AsyncQueue<FDv2SourceResult>;
  private _timerHandle: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly _requestor: FDv2Requestor,
    private readonly _logger: LDLogger | undefined,
    private readonly _selectorGetter: () => string | undefined,
    pollIntervalMs: number,
  ) {
    this._resultQueue = createAsyncQueue<FDv2SourceResult>();
    this._shutdownPromise = new Promise<FDv2SourceResult>((resolve) => {
      this._shutdownResolve = resolve;
    });

    // Start polling immediately and then at regular intervals
    this._doPoll();
    this._timerHandle = setInterval(() => {
      this._doPoll();
    }, pollIntervalMs);
  }

  private async _doPoll(): Promise<void> {
    try {
      const result = await poll(this._requestor, this._selectorGetter(), false, this._logger);

      let shouldShutdown = false;

      if (result.type === 'status') {
        switch (result.state) {
          case 'terminal_error':
            this._stopTimer();
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
        this._shutdownResolve?.(result);
        this._shutdownResolve = undefined;
      } else {
        this._resultQueue.put(result);
      }
    } catch (err) {
      this._logger?.debug(`Polling error: ${err}`);
    }
  }

  async next(): Promise<FDv2SourceResult> {
    return Promise.race([this._shutdownPromise, this._resultQueue.take()]);
  }

  close(): void {
    this._stopTimer();
    this._shutdownResolve?.(shutdown());
    this._shutdownResolve = undefined;
  }

  private _stopTimer(): void {
    if (this._timerHandle !== undefined) {
      clearInterval(this._timerHandle);
      this._timerHandle = undefined;
    }
  }
}
