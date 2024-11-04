type CallbackFunction = () => void;
type UpdateFunction = (cb: CallbackFunction) => void;

export default class UpdateQueue {
  private _queue: [UpdateFunction, CallbackFunction][] = [];

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
      const newCb = () => {
        // We just completed work, so remove it from the queue.
        // Don't remove it before the work is done, because then the
        // count could hit 0, and overlapping execution chains could be started.
        this._queue.shift();
        // There is more work to do, so schedule an update.
        if (this._queue.length > 0) {
          setTimeout(() => this.executePendingUpdates(), 0);
        }
        // Call the original callback.
        cb?.();
      };

      fn(newCb);
    }
  }
}
