type CallbackFunction = (err?: Error) => void;
type UpdateFunction = (cb: CallbackFunction) => void;

// Deadline for a queued update to answer. Past this, the queue abandons it and
// runs the next update, so a store call that never calls back cannot block every
// later update forever.
const DEFAULT_HANG_TIMEOUT_MS = 30000;

export default class UpdateQueue {
  private _queue: [UpdateFunction, CallbackFunction][] = [];

  constructor(private readonly _hangTimeoutMs: number = DEFAULT_HANG_TIMEOUT_MS) {}

  enqueue(updateFn: UpdateFunction, cb: CallbackFunction) {
    this._queue.push([updateFn, cb]);
    if (this._queue.length === 1) {
      // If this is the only item in the queue, then there is not a series
      // of updates already in progress. So we can start executing those updates.
      this.executePendingUpdates();
    }
  }

  executePendingUpdates() {
    if (this._queue.length > 0) {
      const [fn, cb] = this._queue[0];
      // Settles this update exactly once: through the update's own callback, or
      // through the deadline timer. A late callback from an abandoned update is
      // ignored, so it cannot shift an update it does not own.
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const complete = (err?: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timer) {
          clearTimeout(timer);
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
      timer = setTimeout(() => {
        complete(new Error('The queued store operation did not complete in time.'));
      }, this._hangTimeoutMs);

      fn(complete);
    }
  }
}
