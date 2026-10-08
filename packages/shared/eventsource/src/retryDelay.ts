/**
 * Computes a backoff delay from the current base delay and the number of consecutive retries.
 */
export type BackoffStrategy = (baseDelayMillis: number, retryCount: number) => number;

/**
 * Applies jitter to a computed delay.
 */
export type JitterStrategy = (computedDelayMillis: number) => number;

/**
 * The object that the `RetryDelayStrategy` factory returns.
 */
export interface RetryDelayStrategy {
  nextRetryDelay(currentTimeMillis: number): number;
  setGoodSince(goodSinceTimeMillis: number): void;
  setBaseDelay(baseDelay: number): void;
}

// Encapsulation of configurable backoff/jitter behavior.
//
// - The system can either be in a "good" state or a "bad" state. The initial state is "bad"; the
// caller is responsible for indicating when it transitions to "good". A request for a new retry
// delay implies the state is now transitioning to "bad".
//
// - There is a configurable base delay, which can change at any time (when the SSE server sends
// a `retry:` field).
//
// - There are optional strategies for applying backoff and jitter to the delay.
//
// The factory shares its PascalCase name with the interface it returns.
// eslint-disable-next-line @typescript-eslint/naming-convention
export function RetryDelayStrategy(
  baseDelayMillis: number,
  resetIntervalMillis?: number,
  backoff?: BackoffStrategy | null,
  jitter?: JitterStrategy | null,
): RetryDelayStrategy {
  let currentBaseDelay = baseDelayMillis;
  let retryCount = 0;
  let goodSince: number | null | undefined;
  return {
    nextRetryDelay(currentTimeMillis: number): number {
      // A monotonic clock can legally read 0, so the good-since check must not use truthiness.
      if (
        goodSince !== null &&
        goodSince !== undefined &&
        resetIntervalMillis &&
        currentTimeMillis - goodSince >= resetIntervalMillis
      ) {
        retryCount = 0;
      }
      goodSince = null;
      const delay = backoff ? backoff(currentBaseDelay, retryCount) : currentBaseDelay;
      retryCount += 1;
      return jitter ? jitter(delay) : delay;
    },

    setGoodSince(goodSinceTimeMillis: number): void {
      goodSince = goodSinceTimeMillis;
    },

    setBaseDelay(baseDelay: number): void {
      currentBaseDelay = baseDelay;
      retryCount = 0;
    },
  };
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
