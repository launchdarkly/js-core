/**
 * Computes a backoff delay from the current base delay and the number of consecutive retries.
 */
export type BackoffStrategy = (baseDelayMillis: number, retryCount: number) => number;

/**
 * Applies jitter to an already-computed delay.
 */
export type JitterStrategy = (computedDelayMillis: number) => number;

/**
 * Encapsulation of configurable backoff/jitter behavior.
 *
 * - The system can either be in a "good" state or a "bad" state. The initial state is "bad"; the
 * caller is responsible for indicating when it transitions to "good". When we ask for a new retry
 * delay, that implies the state is now transitioning to "bad".
 *
 * - There is a configurable base delay, which can be changed at any time (if the SSE server sends
 * us a "retry:" directive).
 *
 * - There are optional strategies for applying backoff and jitter to the delay.
 */
export class RetryDelayStrategy {
  private _currentBaseDelay: number;

  private _retryCount: number = 0;

  private _goodSince?: number | null;

  constructor(
    baseDelayMillis: number,
    private readonly _resetIntervalMillis?: number,
    private readonly _backoff?: BackoffStrategy | null,
    private readonly _jitter?: JitterStrategy | null,
  ) {
    this._currentBaseDelay = baseDelayMillis;
  }

  nextRetryDelay(currentTimeMillis: number): number {
    if (
      this._goodSince &&
      this._resetIntervalMillis &&
      currentTimeMillis - this._goodSince >= this._resetIntervalMillis
    ) {
      this._retryCount = 0;
    }
    this._goodSince = null;
    const delay = this._backoff
      ? this._backoff(this._currentBaseDelay, this._retryCount)
      : this._currentBaseDelay;
    this._retryCount += 1;
    return this._jitter ? this._jitter(delay) : delay;
  }

  setGoodSince(goodSinceTimeMillis: number): void {
    this._goodSince = goodSinceTimeMillis;
  }

  setBaseDelay(baseDelay: number): void {
    this._currentBaseDelay = baseDelay;
    this._retryCount = 0;
  }
}

export function defaultBackoff(maxDelayMillis: number): BackoffStrategy {
  return (baseDelayMillis: number, retryCount: number) => {
    const d = baseDelayMillis * 2 ** retryCount;
    return d > maxDelayMillis ? maxDelayMillis : d;
  };
}

export function defaultJitter(ratio: number): JitterStrategy {
  return (computedDelayMillis: number) =>
    computedDelayMillis - Math.trunc(Math.random() * ratio * computedDelayMillis);
}
