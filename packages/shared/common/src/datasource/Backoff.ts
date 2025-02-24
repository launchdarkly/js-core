const MAX_RETRY_DELAY = 30 * 1000; // Maximum retry delay 30 seconds.
const JITTER_RATIO = 0.5; // Delay should be 50%-100% of calculated time.

export interface Backoff {
  success(timeStampMs: number): void;
  fail(timeStampMs: number): number;
}

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
export class DefaultBackoff {
  private _retryCount: number = 0;
  private _activeSince?: number;
  private _initialRetryDelayMillis: number;
  /**
   * The exponent at which the backoff delay will exceed the maximum.
   * Beyond this limit the backoff can be set to the max.
   */
  private readonly _maxExponent: number;

  constructor(
    initialRetryDelayMillis: number,
    private readonly _retryResetIntervalMillis: number,
    private readonly _random = Math.random,
  ) {
    // Initial retry delay cannot be 0.
    this._initialRetryDelayMillis = Math.max(1, initialRetryDelayMillis);
    this._maxExponent = Math.ceil(Math.log2(MAX_RETRY_DELAY / this._initialRetryDelayMillis));
  }

  private _backoff(): number {
    const exponent = Math.min(this._retryCount, this._maxExponent);
    const delay = this._initialRetryDelayMillis * 2 ** exponent;
    return Math.min(delay, MAX_RETRY_DELAY);
  }

  private _jitter(computedDelayMillis: number): number {
    return computedDelayMillis - Math.trunc(this._random() * JITTER_RATIO * computedDelayMillis);
  }

  /**
   * This function should be called when a connection attempt is successful.
   *
   * @param timeStampMs The time of the success. Used primarily for testing, when not provided
   * the current time is used.
   */
  success(timeStampMs: number = Date.now()): void {
    this._activeSince = timeStampMs;
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
    if (
      this._activeSince !== undefined &&
      timeStampMs - this._activeSince > this._retryResetIntervalMillis
    ) {
      this._retryCount = 0;
    }
    this._activeSince = undefined;
    const delay = this._jitter(this._backoff());
    this._retryCount += 1;
    return delay;
  }
}
