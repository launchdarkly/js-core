const MAX_RETRY_DELAY = 30 * 1000; // Maximum retry delay 30 seconds.
const JITTER_RATIO = 0.5; // Delay should be 50%-100% of calculated time.
const RESET_INTERVAL = 60 * 1000; // Reset interval in seconds.

/**
 * Implements exponential backoff and jitter. This class tracks successful connections and failures
 * and produces a retry delay.
 *
 * It does not start any timers or directly control a connection.
 *
 * The backoff follows an exponential backoff scheme with 50% jitter starting at
 * initialRetryDelayMillis and capping at MAX_RETRY_DELAY.  If RESET_INTERVAL has elapsed after a
 * success, without an intervening faulure, then the backoff is reset to initialRetryDelayMillis.
 */
export default class Backoff {
  private retryCount: number = 0;
  private activeSince?: number;
  private initialRetryDelayMillis: number;
  /**
   * The exponent at which the backoff delay will exceed the maximum.
   * Beyond this limit the backoff can be set to the max.
   */
  private readonly maxExponent: number;

  constructor(
    initialRetryDelayMillis: number,
    private readonly random = Math.random,
  ) {
    // Initial retry delay cannot be 0.
    this.initialRetryDelayMillis = Math.max(1, initialRetryDelayMillis);
    this.maxExponent = Math.ceil(Math.log2(MAX_RETRY_DELAY / this.initialRetryDelayMillis));
  }

  private backoff(): number {
    const exponent = Math.min(this.retryCount, this.maxExponent);
    const delay = this.initialRetryDelayMillis * 2 ** exponent;
    return Math.min(delay, MAX_RETRY_DELAY);
  }

  private jitter(computedDelayMillis: number): number {
    return computedDelayMillis - Math.trunc(this.random() * JITTER_RATIO * computedDelayMillis);
  }

  /**
   * This function should be called when a connection attempt is successful.
   *
   * @param timeStampMs The time of the success. Used primarily for testing, when not provided
   * the current time is used.
   */
  success(timeStampMs: number = Date.now()): void {
    this.activeSince = timeStampMs;
  }

  /**
   * This function should be called when a connection fails. It returns the a delay, in
   * milliseconds, after which a reconnection attempt should be made.
   *
   * @param timeStampMs The time of the success. Used primarily for testing, when not provided
   * the current time is used.
   * @returns The delay before the next connection attempt.
   */
  fail(timeStampMs: number = Date.now()): number {
    // If the last successful connection was active for more than the RESET_INTERVAL, then we
    // return to the initial retry delay.
    if (this.activeSince !== undefined && timeStampMs - this.activeSince > RESET_INTERVAL) {
      this.retryCount = 0;
    }
    this.activeSince = undefined;
    const delay = this.jitter(this.backoff());
    this.retryCount += 1;
    return delay;
  }
}
