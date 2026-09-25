import { toError } from './storeErrors';

type CallbackFunction = (err?: Error) => void;
// The update receives its completion callback and an isAbandoned check. When the
// queue times the update out, or the queue closes, isAbandoned starts returning
// true. The update's late completion handler must consult it before applying side
// effects: the queue has already moved on, so a newer operation's results may
// otherwise be overwritten.
type UpdateFunction = (cb: CallbackFunction, isAbandoned: () => boolean) => void;

// Deadline for a queued update to answer. Past this, the queue abandons it and
// runs the next update, so a store call that never calls back cannot block every
// later update forever.
const DEFAULT_HANG_TIMEOUT_MS = 30000;

const QUEUE_FAILURE_FALLBACK_MESSAGE =
  'The queued store operation failed with a reason that could not be described.';

export default class UpdateQueue {
  private _queue: [UpdateFunction, CallbackFunction][] = [];

  private _timer?: ReturnType<typeof setTimeout>;

  private _closed = false;

  // Abandons the executing update when the queue closes, so its late answer is
  // ignored.
  private _abandonCurrent?: () => void;

  constructor(private readonly _hangTimeoutMs: number = DEFAULT_HANG_TIMEOUT_MS) {}

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
   * Stops the queue: the executing update is abandoned, its deadline timer is
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
    // Settles this update exactly once: through the update's own callback, the
    // deadline timer, or close. A late callback from an abandoned update is
    // ignored, so it cannot shift an update it does not own.
    let settled = false;
    let abandoned = false;
    this._abandonCurrent = () => {
      settled = true;
      abandoned = true;
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
    this._timer = setTimeout(() => {
      this._timer = undefined;
      abandoned = true;
      complete(new Error('The queued store operation did not complete in time.'));
    }, this._hangTimeoutMs);

    // A synchronous throw from the update must fail this update only, not escape
    // into the timer chain that started it.
    try {
      fn(complete, () => abandoned);
    } catch (reason) {
      complete(toError(reason, QUEUE_FAILURE_FALLBACK_MESSAGE));
    }
  }
}
