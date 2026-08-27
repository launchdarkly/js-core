/**
 * Payload of the `error` and `end` events.
 *
 * The optional `type` and the exact `headers` typing are deliberate: this shape must be
 * structurally interchangeable with the `HttpErrorResponse` used by the LaunchDarkly SDK platform
 * abstraction, in both directions (it is both the argument of `onerror` and the argument of the
 * `errorFilter` callback the SDK supplies).
 */
export interface ErrorEvent {
  readonly type?: string;
  readonly message: string;
  readonly status?: number;
  readonly headers?: Record<string, string>;
}

/**
 * Payload of the `open` event.
 */
export interface OpenEvent {
  readonly type?: string;
  readonly headers?: Record<string, string | string[] | undefined>;
}

/**
 * Payload of the `retrying` event.
 */
export interface RetryingEvent {
  readonly type?: string;
  readonly delayMillis: number;
}

/**
 * Payload of the `closed` event.
 */
export interface ClosedEvent {
  readonly type?: string;
}

/**
 * Payload of the `message` event and of any event delivered for a named SSE `event:` type.
 */
export interface MessageEvent {
  readonly type: string;
  readonly data: string;
  readonly lastEventId: string;
  readonly origin: string;
}

/**
 * Listener registered through `addEventListener`. Events are delivered as the payload types above,
 * or as an arbitrary payload when delivered through `dispatchEvent`.
 */
export type EventSourceListener = (event?: any) => void;

/**
 * TLS options merged into the outgoing request. Only these names are recognized; anything else is
 * ignored.
 */
export interface EventSourceHttpsOptions {
  pfx?: string | string[] | Buffer | Buffer[] | object[];
  key?: string | string[] | Buffer | Buffer[] | object[];
  passphrase?: string;
  cert?: string | string[] | Buffer | Buffer[];
  ca?: string | string[] | Buffer | Buffer[];
  ciphers?: string;
  rejectUnauthorized?: boolean;
  secureProtocol?: string;
  servername?: string;
  checkServerIdentity?: (hostname: string, cert: any) => Error | undefined;
}

/**
 * Options for the EventSource constructor.
 */
export interface EventSourceInitDict {
  /**
   * Decides whether a given error should be retried. Return false to stop retrying and close the
   * stream. When omitted, I/O errors and HTTP 500/502/503/504 are retried.
   */
  errorFilter?: (err: ErrorEvent) => boolean;

  /**
   * Additional headers to send with each request.
   */
  headers?: Record<string, string | string[] | number | undefined>;

  /**
   * TLS options for https requests.
   */
  https?: EventSourceHttpsOptions;

  /**
   * Base delay, in milliseconds, before the first reconnection attempt. Defaults to 1000.
   */
  initialRetryDelayMillis?: number;

  /**
   * If set, each computed retry delay is randomly reduced by up to this fraction of itself.
   */
  jitterRatio?: number;

  /**
   * If set, retry delays grow exponentially up to this ceiling.
   */
  maxBackoffMillis?: number;

  /**
   * HTTP method. Defaults to the Node default (GET).
   */
  method?: string;

  /**
   * URL of an HTTP proxy to send the request through.
   */
  proxy?: string;

  /**
   * How long the stream must have been healthy before the backoff counter resets.
   */
  retryResetIntervalMillis?: number;

  /**
   * Omit the default `Cache-Control: no-cache` and `Accept: text/event-stream` headers.
   */
  skipDefaultHeaders?: boolean;

  /**
   * Passed through to the request options.
   */
  withCredentials?: boolean;

  /**
   * Close and retry the connection if no data is received for this many milliseconds.
   */
  readTimeoutMillis?: number;

  /**
   * Request body, for use with a non-GET `method`.
   */
  body?: string;

  /**
   * A Node http/https agent to use for the request. Proxies can be configured this way as an
   * alternative to `proxy`.
   */
  agent?: any;

  /**
   * Legacy alias for `https.rejectUnauthorized`. Applied before `https` options are merged, so
   * `https.rejectUnauthorized` overrides it when both are set. Omitting both this field and
   * `https.rejectUnauthorized` results in `rejectUnauthorized: false` (certificate validation
   * disabled) -- NOT Node's own default of `true`.
   */
  rejectUnauthorized?: boolean;
}

/**
 * Names of the custom (non-W3C) options this implementation understands. Exposed at runtime as
 * `EventSource.supportedOptions`.
 */
export type SupportedOptionName =
  | 'errorFilter'
  | 'headers'
  | 'https'
  | 'initialRetryDelayMillis'
  | 'jitterRatio'
  | 'maxBackoffMillis'
  | 'method'
  | 'proxy'
  | 'retryResetIntervalMillis'
  | 'skipDefaultHeaders'
  | 'withCredentials';
