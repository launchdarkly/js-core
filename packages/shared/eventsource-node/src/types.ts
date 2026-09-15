import type {
  EventSourceInitDict as PlatformEventSourceInitDict,
  HttpErrorResponse,
} from '@launchdarkly/js-sdk-common';

/**
 * The payload of the `error` and `end` events.
 *
 * Extends the platform's `HttpErrorResponse` -- it is the argument of `onerror` and of the SDK's
 * `errorFilter` callback, so it must stay interchangeable with that shape in both directions.
 * The only addition is the `type` field that this implementation stamps on every event payload.
 */
export interface ErrorEvent extends HttpErrorResponse {
  readonly type?: string;
}

/**
 * The payload of the `open` event.
 */
export interface OpenEvent {
  readonly type?: string;
  readonly headers?: Record<string, string | string[] | undefined>;
}

/**
 * The payload of the `retrying` event.
 */
export interface RetryingEvent {
  readonly type?: string;
  readonly delayMillis: number;
}

/**
 * The payload of the `closed` event.
 */
export interface ClosedEvent {
  readonly type?: string;
}

/**
 * The payload of the `message` event, and of each event for a named SSE `event:` type.
 */
export interface MessageEvent {
  readonly type: string;
  readonly data: string;
  readonly lastEventId: string;
  readonly origin: string;
}

/**
 * A listener registered through `addEventListener`.
 *
 * Deviation from the platform's `EventListener` type (`(event?: { data?: any }) => void`): the
 * payloads this implementation dispatches are not limited to `data`-carrying message events
 * (`open` carries `headers`, `retrying` carries `delayMillis`, ...), so the parameter stays `any`
 * for contextual-typing ergonomics. A listener typed with the platform's shape remains assignable.
 */
export type EventSourceListener = (event?: any) => void;

/**
 * The base options that the EventSource implementation understands. `NodeEventSourceInitDict`
 * extends this interface with the Node transport options.
 *
 * Inherits the platform's `EventSourceInitDict` fields, with two deviations:
 *
 * - `urlBuilder` is omitted: this package does not support it.
 * - `errorFilter` is redeclared to receive this package's `ErrorEvent` (the platform's
 *   `HttpErrorResponse` plus the `type` field); the two remain interchangeable.
 *
 * Each field that the SDK supplies stays required here, to match the platform contract. A caller
 * that constructs an EventSource directly can omit each field, because the constructor parameter
 * is `Partial<...>`. A missing field falls back to a default (`errorFilter`,
 * `initialRetryDelayMillis`), or the feature stays off (`headers`, `readTimeoutMillis`,
 * `retryResetIntervalMillis`).
 */
export interface EventSourceInitDict extends Omit<PlatformEventSourceInitDict, 'urlBuilder'> {
  /**
   * Decides if the client retries a given error. Return false to stop the retries and close the
   * stream. When this field is not set, the client retries I/O errors and HTTP 500, 502, 503,
   * and 504.
   */
  errorFilter: (err: ErrorEvent) => boolean;

  /**
   * If set, the client decreases each computed retry delay by a random amount. The maximum
   * decrease is this fraction of the delay.
   */
  jitterRatio?: number;

  /**
   * If set, retry delays grow exponentially up to this limit.
   */
  maxBackoffMillis?: number;

  /**
   * When true, the request omits the default `Cache-Control: no-cache` and
   * `Accept: text/event-stream` headers.
   */
  skipDefaultHeaders?: boolean;
}

/**
 * TLS options that the client merges into the outgoing request. The client recognizes only these
 * names and ignores all other names.
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
 * The options for the Node EventSource constructor. These are the shared options plus the options
 * that apply only to a Node http/https request.
 */
export interface NodeEventSourceInitDict extends EventSourceInitDict {
  /**
   * TLS options for https requests.
   */
  https?: EventSourceHttpsOptions;

  /**
   * The URL of an HTTP proxy. The client sends the request through this proxy.
   */
  proxy?: string;

  /**
   * A Node http/https agent for the request. An agent is an alternative way to configure a proxy.
   */
  agent?: any;
}

/**
 * The names of the custom (non-W3C) options that the Node implementation understands. The runtime
 * value `EventSource.supportedOptions` contains these names.
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
  | 'skipDefaultHeaders';
