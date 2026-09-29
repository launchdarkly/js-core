import type { HttpErrorResponse } from './Requests';

export type EventName = string;
export type EventListener = (event?: { data?: any }) => void;
export type ProcessStreamResponse = {
  deserializeData: (data: string) => any;
  processJson: (json: any, initHeaders?: { [key: string]: string }) => void;
};

export interface EventSource {
  onclose: (() => void) | undefined;
  onerror: ((err?: HttpErrorResponse) => void) | undefined;
  onopen: ((e: { headers?: { [key: string]: string } }) => void) | undefined;
  onretrying: ((e: { delayMillis: number }) => void) | undefined;

  addEventListener(type: EventName, listener: EventListener): void;
  close(): void;
}

/**
 * The strategy an {@link EventSource} uses to decide how long to wait before
 * each reconnection attempt. It is injected so a data source can drive
 * reconnection timing from its own retry state rather than the transport's
 * built-in backoff. The `nowMs` arguments are the transport's wall clock; an
 * implementation that keeps its own clock may ignore them.
 */
export interface EventSourceRetryDelayStrategy {
  /** Returns the delay, in milliseconds, before the next reconnection. */
  nextRetryDelay(nowMs: number): number;
  /** Records that the connection is currently healthy. */
  setGoodSince(nowMs: number): void;
  /** Applies a server-directed base delay, in milliseconds. */
  setBaseDelay(baseDelayMs: number): void;
}

export interface EventSourceInitDict {
  method?: string;
  headers: { [key: string]: string | string[] };
  body?: string;
  errorFilter: (err: HttpErrorResponse) => boolean;
  readTimeoutMillis: number;

  /**
   * The built-in backoff's initial delay and reset window. Unused when
   * {@link retryDelayStrategy} is set, since the strategy then owns all
   * reconnection timing.
   */
  initialRetryDelayMillis?: number;
  retryResetIntervalMillis?: number;

  /**
   * When set, the EventSource defers all reconnection timing to this strategy
   * instead of its built-in backoff. `initialRetryDelayMillis` and
   * `retryResetIntervalMillis` are then unused.
   */
  retryDelayStrategy?: EventSourceRetryDelayStrategy;
  /**
   * Optional callback that returns a fresh URL on each reconnection attempt.
   * When provided, the EventSource implementation should call this instead of
   * reusing the original URL. This allows query parameters (e.g. `basis`) to
   * be updated between reconnections.
   */
  urlBuilder?: () => string;
}
