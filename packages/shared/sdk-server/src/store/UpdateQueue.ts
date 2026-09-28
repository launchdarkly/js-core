import { LDLogger } from '@launchdarkly/js-sdk-common';

import { toError } from './storeErrors';

type CallbackFunction = (err?: Error) => void;
// The update receives its completion callback and an isAbandoned check. When the
// queue closes, or the update has already answered once, isAbandoned starts
// returning true. The update's late completion handler must consult it before
// applying side effects: the result no longer owns the current state.
type UpdateFunction = (cb: CallbackFunction, isAbandoned: () => boolean) => void;

// A queued update past this deadline logs a warning. The queue never abandons
// the update: later updates wait for it, so the store receives every write in
// order. An abandoned update could otherwise complete at the store after a
// newer one and leave the store holding older data.
const DEFAULT_SLOW_UPDATE_WARNING_MS = 30000;

const QUEUE_FAILURE_FALLBACK_MESSAGE =
  'The queued store operation failed with a reason that could not be described.';

export default class UpdateQueue {
  private _queue: [UpdateFunction, CallbackFunction][] = [];

  // Warns once per update when the update runs past its deadline.
  private _timer?: ReturnType<typeof setTimeout>;

  private _closed = false;

  // Abandons the executing update when the queue closes, so its late answer is
  // ignored.
  private _abandonCurrent?: () => void;

  constructor(
    private readonly _logger?: LDLogger,
    private readonly _slowUpdateWarningMs: number = DEFAULT_SLOW_UPDATE_WARNING_MS,
  ) {}

  enqueue(updateFn: UpdateFunction, cb: CallbackFunction) {
    if (this._closed) {
      cb?.(new Error('The store is closed.'));
      return;
    }
    this._queue.push([updateFn, cb]);
    if (this._queue.length === 1) {
      // If this is the only item in the queue, then there is not a series
      // of updates already in progress. So we can start executing those updates.
      this.executePendingUpdates();
    }
  }

  /**
   * Stops the queue: the executing update is abandoned, its warning timer is
   * cleared, and every waiting update is failed without invoking its store call.
   */
  close(): void {
    if (this._closed) {
      return;
    }
    this._closed = true;
    this._abandonCurrent?.();
    this._abandonCurrent = undefined;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
    const pending = this._queue;
    this._queue = [];
    pending.forEach(([, cb]) => cb?.(new Error('The store is closed.')));
  }

  executePendingUpdates() {
    if (this._closed || this._queue.length === 0) {
      return;
    }
    const [fn, cb] = this._queue[0];
    // Settles this update exactly once: through the update's own callback, or
    // close. A late callback after close, or a second callback after a normal
    // completion, is ignored, so it cannot shift an update it does not own.
    let settled = false;
    this._abandonCurrent = () => {
      settled = true;
    };
    const complete = (err?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      this._abandonCurrent = undefined;
      if (this._timer) {
        clearTimeout(this._timer);
        this._timer = undefined;
      }
      // We just completed work, so remove it from the queue.
      // Don't remove it before the work is done, because then the
      // count could hit 0, and overlapping execution chains could be started.
      this._queue.shift();
      // There is more work to do, so schedule an update.
      if (this._queue.length > 0) {
        setTimeout(() => this.executePendingUpdates(), 0);
      }
      // Call the original callback.
      cb?.(err);
    };
    // The timer only warns. The update stays the head of the queue until it
    // answers, so later updates cannot overtake it at the store.
    this._timer = setTimeout(() => {
      this._timer = undefined;
      this._logger?.warn(
        `A store operation did not complete within ${
          this._slowUpdateWarningMs / 1000
        } seconds. Later store operations wait for it, so the store receives writes in order.`,
      );
    }, this._slowUpdateWarningMs);

    // A synchronous throw from the update must fail this update only, not escape
    // into the timer chain that started it. isAbandoned reports true once the
    // update has settled, so a store that answers a second time after a normal
    // completion is fenced the same way as one that answers after close.
    try {
      fn(complete, () => settled);
    } catch (reason) {
      complete(toError(reason, QUEUE_FAILURE_FALLBACK_MESSAGE));
    }
  }
}
