export type BuiltInEventType = 'open' | 'message' | 'error' | 'close' | 'retry';
export type EventType<E extends string = never> = E | BuiltInEventType;

export interface MessageEvent {
  type: 'message';
  data: string | null;
  lastEventId: string | undefined;
  url: string;
}

export interface OpenEvent {
  type: 'open';
  headers?: Record<string, string>;
}

export interface CloseEvent {
  type: 'close';
}

export interface RetryEvent {
  type: 'retry';
  delayMillis: number;
}

export interface TimeoutEvent {
  type: 'timeout';
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  xhrState: number;
  xhrStatus: number;
  /**
   * Present when the error corresponds to an HTTP response with a numeric
   * status, as opposed to a network-level failure with no response at all.
   * Consumers' `errorFilter`/`onerror` handlers rely on this to tell an
   * HTTP-status error apart from a network error.
   */
  status?: number;
  /** Parsed response headers, present under the same condition as `status`. */
  headers?: Record<string, string>;
}

export interface CustomEvent<E extends string> {
  type: E;
  data: string | null;
  lastEventId: string | null;
  url: string;
}

export interface ExceptionEvent {
  type: 'exception';
  message: string;
  error: Error;
}

export interface EventSourceOptions {
  method?: string;
  timeout?: number;
  withCredentials?: boolean;
  headers?: Record<string, any>;
  body?: any;
  retryAndHandleError?: (err: any) => boolean;
  initialRetryDelayMillis?: number;
  logger?: any;
  /**
   * Called before each (re)connection to compute the URL to connect to. When
   * provided, this takes precedence over the static URL so that reconnections
   * pick up state that changes over the connection's lifetime (for example the
   * FDv2 `basis` selector, which must be replayed on reconnect).
   */
  urlBuilder?: () => string;
}

type BuiltInEventMap = {
  message: MessageEvent;
  open: OpenEvent;
  close: CloseEvent;
  error: ErrorEvent | TimeoutEvent | ExceptionEvent;
  retry: RetryEvent;
};

export type EventSourceEvent<E extends T, T extends string = any> = E extends BuiltInEventType
  ? BuiltInEventMap[E]
  : CustomEvent<E>;

export type EventSourceListener<E extends string = never, T extends EventType<E> = EventType<E>> = (
  event: EventSourceEvent<T>,
) => void;
