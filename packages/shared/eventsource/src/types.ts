/*
 * Several types in this file mirror shapes from `@launchdarkly/js-sdk-common` without importing
 * them. The `typeCompatibility` test suite enforces that they stay compatible with that platform
 * contract.
 */

export type {
  ClosedEvent,
  ErrorEvent,
  EventSourceEventMap,
  MessageEvent,
  OpenEvent,
  RetryingEvent,
} from './Event';

import type { ErrorEvent } from './Event';
import type { FetchFn } from './httpHelpers';

/**
 * A listener as the registry stores it. The registry stores listeners for every event type,
 * including SSE event names the server chooses at runtime, so the stored shape is untyped. The
 * typed `addEventListener` overloads on `EventSource` narrow the payload for callers.
 */
export type RegisteredEventListener = (event: any) => void;

/**
 * Stores and dispatches the listeners that an `EventSource` instance registers through
 * `addEventListener`. The `on*` slots are plain members of the instance. The registry never
 * sees them.
 *
 * The default implementation uses a `Map` (`createDefaultEventRegistry`). A caller can supply a
 * different implementation through the `createEventRegistry` init option, for example one that
 * uses Node's `EventEmitter`. Note that `EventEmitter` throws from `emit('error')` when `error`
 * has no listener. A substitute must not do this. `dispatch` must stay silent when a type has
 * no listener.
 */
export interface EventListenerRegistry {
  /**
   * Adds `listener` at the end of the list for `type`. The same listener can register more than
   * once.
   */
  addEventListener(type: string, listener: RegisteredEventListener): void;

  /**
   * Removes at most one registration of `listener` for `type`. The most recent registration is
   * the one removed, as `removeListener` in `EventEmitter` does.
   */
  removeEventListener(type: string, listener: RegisteredEventListener): void;

  /**
   * Calls each listener registered for `type` with `event`. Does nothing when `type` has no
   * registered listener. Unlike `emit('error')` in `EventEmitter`, this never throws when a
   * type has no listener.
   *
   * A substitute implementation must copy the listener list before it iterates. A listener
   * removed during a dispatch still runs in that dispatch. A listener added during a dispatch
   * waits for the next dispatch. An exception from a listener propagates to the caller of
   * `dispatch`.
   */
  dispatch(type: string, event: unknown): void;
}

/**
 * Creates the registry for one `EventSource` instance. `createEventSource` calls the factory
 * once, so each instance gets its own registry.
 */
export type EventListenerRegistryFactory = () => EventListenerRegistry;

export type {
  FetchBodyReader,
  FetchFn,
  FetchHeaders,
  FetchRequestOptions,
  FetchResponse,
  FetchResponseBody,
} from './httpHelpers';

/**
 * The options that `createEventSource` understands.
 *
 * The first group of fields mirrors the platform's `EventSourceInitDict`. Each field that the SDK
 * supplies stays required here, to match the platform contract. A caller that calls
 * `createEventSource` directly can omit each field, because that function's parameter is
 * `Partial<...>`. A missing field falls back to a default (`errorFilter`,
 * `initialRetryDelayMillis`), or the feature stays off (`headers`, `readTimeoutMillis`,
 * `retryResetIntervalMillis`).
 */
export interface EventSourceInitDict {
  method?: string;

  headers: { [key: string]: string | string[] };

  body?: string;

  /**
   * Decides if the client retries a given error. Return false to stop the retries and close the
   * stream. When this field is not set, the client retries I/O errors and HTTP 500, 502, 503,
   * and 504.
   */
  errorFilter: (err: ErrorEvent) => boolean;

  initialRetryDelayMillis: number;

  readTimeoutMillis: number;

  retryResetIntervalMillis: number;

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

  /**
   * When true, the client sends credentials (cookies, HTTP authentication) with the request, also
   * cross-origin. This flag maps to `credentials: 'include'` in `fetch()`. A transport without a
   * credentials concept ignores it.
   */
  withCredentials?: boolean;

  /**
   * Returns the URL for the next connection attempt. When set, the client calls this function
   * immediately before each request, including the first. This keeps a query parameter current
   * when the parameter changes between attempts.
   */
  urlBuilder?: () => string;

  /**
   * The transport used to open the stream. When absent, the client uses the global `fetch`.
   *
   * The client only needs the structural subset declared by {@link FetchFn}, so a real `fetch`
   * implementation satisfies this option without casts. A platform without a suitable global
   * `fetch`, or one that needs agents, proxies, or TLS configuration, supplies a function with
   * the same shape over its own transport.
   */
  fetch?: FetchFn;

  /**
   * Creates the listener registry for this instance. The registry stores the listeners
   * registered through `addEventListener`. When this option is absent, the instance uses the
   * internal `Map`-backed registry (`createDefaultEventRegistry`).
   *
   * A substitute must satisfy {@link EventListenerRegistry}. An SDK can supply one that uses a
   * native eventing primitive, such as Node's `EventEmitter`. A raw `EventEmitter` throws from
   * `emit('error')` when `error` has no listener. An `EventEmitter`-backed substitute must
   * guard against that case.
   *
   * The registry is trusted code. It sees every event this instance dispatches, and it controls
   * what its listeners receive.
   *
   * `createEventSource` throws a `TypeError` that names `createEventRegistry` when this option
   * is not a function, or when the returned value is missing a required `EventListenerRegistry`
   * method.
   *
   * This function must return a new registry on each call. `createEventSource` calls it once
   * per instance. When a factory returns one shared registry for more than one instance, the
   * separate event sources deliver each other's events.
   */
  createEventRegistry?: EventListenerRegistryFactory;
}
