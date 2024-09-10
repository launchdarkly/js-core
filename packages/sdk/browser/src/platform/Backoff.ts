const maxRetryDelay = 30 * 1000; // Maximum retry delay 30 seconds.
const jitterRatio = 0.5; // Delay should be 50%-100% of calculated time.

function jitter(computedDelayMillis: number): number {
  return computedDelayMillis - Math.trunc(Math.random() * jitterRatio * computedDelayMillis);
}

export default class Backoff {
  private retryCount: number = 0;

  constructor(private readonly initialRetryDelayMillis: number) {}

  reset(): void {
    this.retryCount = 0;
  }

  backoff(): number {
    const delay = this.initialRetryDelayMillis * 2 ** this.retryCount;
    return delay > maxRetryDelay ? maxRetryDelay : delay;
  }

  getNextRetryDelay(): number {
    const delay = jitter(this.backoff());
    this.retryCount += 1;
    return delay;
  }
}
