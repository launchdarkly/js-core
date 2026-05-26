// The test harness records hook callbacks in network-arrival order, so
// parallel fetches break ordering assertions. Chain them instead.
export class HookPostQueue {
  private _chain: Promise<void> = Promise.resolve();

  enqueue(fn: () => Promise<void>): void {
    this._chain = this._chain.then(fn).catch(() => {});
  }
}
