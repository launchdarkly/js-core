/**
 * Computes a backoff delay from the current base delay and the number of consecutive retries.
 */
export type BackoffStrategy = (baseDelayMillis: number, retryCount: number) => number;

/**
 * Applies jitter to a computed delay.
 */
export type JitterStrategy = (computedDelayMillis: number) => number;

/**
 * The object that the `RetryDelayStrategy` factory returns. This interface is TypeScript
 * scaffolding. It has no counterpart in the original `retry-delay.js`. The factory function below
 * is the port of that file.
 */
export interface RetryDelayStrategy {
  nextRetryDelay(currentTimeMillis: number): number;
  setGoodSince(goodSinceTimeMillis: number): void;
  setBaseDelay(baseDelay: number): void;
}

// Encapsulation of configurable backoff/jitter behavior.
//
// - The system can either be in a "good" state or a "bad" state. The initial state is "bad"; the
// caller is responsible for indicating when it transitions to "good". When we ask for a new retry
// delay, that implies the state is now transitioning to "bad".
//
// - There is a configurable base delay, which can be changed at any time (if the SSE server sends
// us a "retry:" directive).
//
// - There are optional strategies for applying backoff and jitter to the delay.
//
// The factory keeps the PascalCase name of the original function.
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
      if (
        goodSince &&
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
