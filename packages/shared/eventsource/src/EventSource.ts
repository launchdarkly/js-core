/**
 * @remark
 * This implementation is derived from `eventsource.js` of LaunchDarkly's original
 * `launchdarkly-eventsource` (js-eventsource) package.
 */

import {
  ErrorEvent,
  EventSourceEventMap,
  makeEvent,
  MessageEvent,
  OpenEvent,
  RawErrorPayload,
  RetryingEvent,
} from './Event';
import { bodylessMethods, defaultFetch, headersToObject } from './httpHelpers';
import { createDefaultEventRegistry } from './listenerRegistry';
import { createParser } from './parser';
import { INVALID_HEADER_VALUE_CHAR } from './parsing';
import * as retryDelay from './retryDelay';
import {
  EventListenerRegistry,
  EventSourceInitDict,
  FetchFn,
  FetchRequestOptions,
  FetchResponse,
} from './types';

/** Ready state: no connection is open, and none is being attempted. */
export const CONNECTING = 0;

/** Ready state: the connection is open and events can be delivered. */
export const OPEN = 1;

/** Ready state: `close()` has closed the connection; it will not reconnect. */
export const CLOSED = 2;

// A server-directed retry: value larger than this is treated as this value; anything
// larger would be indistinguishable from the connection never resuming. It also keeps
// the reconnect delay far below the runtime timer limit, which some runtimes replace
// with a near-zero delay.
const MAX_SERVER_DIRECTED_RETRY_DELAY_MILLIS = 60 * 60 * 1000; // 1 hour

/**
 * Wrap a callback to ensure it can only be called once.
 */
function once<T extends (...args: any[]) => void>(cb: T): (...args: Parameters<T>) => void {
  let called = false;
  return (...params: Parameters<T>) => {
    if (!called) {
      called = true;
      cb(...params);
    }
  };
}

function defaultErrorFilter(error: ErrorEvent): boolean {
  if (error.status) {
    const s = error.status;
    return s === 500 || s === 502 || s === 503 || s === 504;
  }
  return true; // always return I/O errors
}

/**
 * Computes the origin that message events report.
 *
 * A relative URL resolves against the document location when one exists. When no absolute URL
 * can form, the origin is an empty string.
 */
function resolveStreamOrigin(candidate: string): string {
  const base = typeof location !== 'undefined' ? location.href : undefined;
  try {
    return new URL(candidate, base).origin;
  } catch {
    return '';
  }
}

/**
 * A W3C-compliant EventSource (server-sent events) client built on a `fetch()`-shaped transport,
 * `ReadableStream`, and `AbortController`. Unlike the native browser `EventSource`, an event
 * source built by this package supports request headers, a custom method with a request body,
 * and a read timeout.
 *
 * @remark
 * The SSE behavior stays as close as possible to the behavior of the original
 * `launchdarkly-eventsource` package: the same event names and shapes, the same retry and
 * backoff timing, and the same `text/event-stream` parser algorithm.
 *
 * @remark
 * The Node-only options (`https`, `proxy`, `agent`, `rejectUnauthorized`) do not exist here,
 * because `fetch()` has no equivalent for them; a caller that needs transport control injects
 * a `fetch`-shaped function instead.
 *
 * @remark
 * There is no `onmessage` slot. The LaunchDarkly SDKs register their message listeners with
 * `addEventListener('message', ...)`, so this implementation leaves the slot out on purpose.
 *
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html
 */
export interface EventSource {
  readonly readyState: number;

  readonly url: string;

  /**
   * Mirrors the most recent server `retry:` field, in milliseconds; starts at 1000 before any
   * `retry:` field has arrived. A server-directed value is capped at one hour. The retry
   * strategy owns the actual reconnect timing; writing to this slot has no effect on it.
   */
  reconnectInterval: number;

  /**
   * Called when a connection is established, with the HTTP response headers in the event.
   *
   * An exception this slot throws does not stop the read loop from starting. The exception
   * rethrows later, on a separate microtask.
   */
  onopen: ((event: OpenEvent) => void) | undefined;

  /**
   * Called for a connection-level failure or an HTTP error response. A server-sent SSE frame
   * named `error` also reaches this slot, with a `MessageEvent` payload; only that frame carries
   * a string `data` property.
   *
   * An exception this slot throws does not stop the reconnect that follows. The exception
   * rethrows later, on a separate microtask.
   */
  onerror: ((event?: ErrorEvent) => void) | undefined;

  /**
   * Called when a reconnect is scheduled, with the delay in the event.
   *
   * An exception this slot throws does not stop the reconnect timer from arming. The exception
   * rethrows later, on a separate microtask.
   */
  onretrying: ((event: RetryingEvent) => void) | undefined;

  /**
   * Called once when `close()` closes the stream, before the listeners registered for the
   * `closed` event. Only the public `close()` method invokes it: an internal non-retryable
   * termination dispatches the `error` and `closed` events without it (the `errorFilter` caller
   * already received that error), and a server-sent SSE frame named `closed` reaches only the
   * `addEventListener('closed')` listeners. Thus neither can look like a user-initiated close.
   */
  onclose: (() => void) | undefined;

  /**
   * Registers `listener` for events of type `type`. The payload type follows
   * {@link EventSourceEventMap} for the event types this implementation itself dispatches; an SSE
   * event with a server-chosen name carries a {@link MessageEvent}.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
   */
  addEventListener<K extends keyof EventSourceEventMap>(
    type: K,
    listener: (event: EventSourceEventMap[K]) => void,
  ): void;
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;

  /**
   * Removes the most recent registration of `listener` for events of type `type`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/removeEventListener
   */
  removeEventListener<K extends keyof EventSourceEventMap>(
    type: K,
    listener: (event: EventSourceEventMap[K]) => void,
  ): void;
  removeEventListener(type: string, listener: (event: MessageEvent) => void): void;

  /**
   * Closes the connection, if one is made, and sets the readyState attribute to 2 (closed).
   * Invokes `onclose` and dispatches the `closed` event. This function is idepotent.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/EventSource/close
   */
  close(): void;
}

/**
 * The `EventSource` members that the returned object keeps as its own, enumerable properties
 * (the caller's writable surface), as opposed to the non-enumerable accessors and methods added
 * afterward through `Object.defineProperties`.
 */
type OwnSlots = 'reconnectInterval' | 'onopen' | 'onerror' | 'onretrying' | 'onclose';

/**
 * Creates a new EventSource. The connection attempt starts before this function returns, so a
 * caller must attach any listener it needs (`onopen`, `onerror`, `addEventListener`, ...) right
 * after this call, before any other code runs, to avoid missing an event.
 *
 * @param url The URL to which to connect.
 * @param eventSourceInitDict Extra init params. See README for details.
 */
export function createEventSource(
  url: string,
  eventSourceInitDict?: Partial<EventSourceInitDict>,
): EventSource {
  const config = (eventSourceInitDict ?? {}) as EventSourceInitDict;

  if (
    config.createEventRegistry !== undefined &&
    typeof config.createEventRegistry !== 'function'
  ) {
    throw new TypeError('createEventRegistry must be a function');
  }
  const registry: EventListenerRegistry = (
    config.createEventRegistry ?? createDefaultEventRegistry
  )();
  if (
    typeof registry?.addEventListener !== 'function' ||
    typeof registry?.removeEventListener !== 'function' ||
    typeof registry?.dispatch !== 'function'
  ) {
    throw new TypeError(
      'createEventRegistry must return an object with addEventListener, removeEventListener, ' +
        'and dispatch functions',
    );
  }

  let currentUrl = url;
  let readyState: number = CONNECTING;

  let lastEventId = '';
  if (config.headers) {
    // The header name is matched without regard to case, like an HTTP header. An array value
    // cannot form one id; its first element is the seed.
    const seedKey = Object.keys(config.headers).find(
      (key) => key.toLowerCase() === 'last-event-id',
    );
    if (seedKey !== undefined) {
      const seedValue = config.headers[seedKey];
      const seed = Array.isArray(seedValue) ? seedValue[0] : seedValue;
      // A missing value means no seed. A seed that fails the header-value test would make the
      // Last-Event-ID header assignment throw on every attempt.
      if (seed !== undefined && seed !== null && !INVALID_HEADER_VALUE_CHAR.test(seed)) {
        lastEventId = String(seed);
      }
    }
  }

  let goodSinceAnchored = false;

  // A caller-supplied strategy fully replaces the built-in one. The built-in tuning options
  // have no effect when it is set.
  const retryDelayStrategy =
    config.retryDelayStrategy ??
    retryDelay.RetryDelayStrategy(
      config.initialRetryDelayMillis !== null && config.initialRetryDelayMillis !== undefined
        ? config.initialRetryDelayMillis
        : 1000,
      config.retryResetIntervalMillis,
      config.maxBackoffMillis ? retryDelay.defaultBackoff(config.maxBackoffMillis) : null,
      config.jitterRatio ? retryDelay.defaultJitter(config.jitterRatio) : null,
    );

  // The origin that message events report. Each connection computes it in the response
  // callback, because urlBuilder can pick a new URL between reconnects and the transport can
  // follow redirects.
  let streamOriginUrl = '';

  // The transport is injectable. `defaultFetch` documents the default behavior.
  const doFetch: FetchFn = config.fetch ?? defaultFetch;

  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  /** Aborts the current request. Each connection attempt replaces this controller. */
  let abortController: AbortController | undefined;

  let readTimeoutHandle: ReturnType<typeof setTimeout> | undefined;

  /**
   * Each connection attempt increases this counter. A read loop, or a `fetch()` promise, from an
   * old attempt compares its own generation against this counter and stops.
   */
  let generation = 0;

  const self = {
    reconnectInterval: 1000,
    onopen: undefined,
    onerror: undefined,
    onretrying: undefined,
    onclose: undefined,
  } satisfies Pick<EventSource, OwnSlots> as EventSource;

  /**
   * Dispatches one event: the matching on* slot first, then the listeners registered for the
   * event's type.
   *
   * A server-sent SSE frame whose `event:` name is `open`, `error`, or `retrying` also reaches
   * the matching slot, with the frame's `MessageEvent` payload, exactly as it reaches the
   * registered listeners of that type.
   *
   * @remark
   * Excluding `close` is intentional as only `close()` invokes `onclose`, so neither a data
   * frame nor an internal termination can look like a user-initiated close.
   */
  const emit = (event: EventSourceEventMap[keyof EventSourceEventMap]): void => {
    let slotThrew = false;
    let slotError: unknown;
    switch (event.type) {
      case 'open':
        try {
          self.onopen?.(event as OpenEvent);
        } catch (err) {
          slotThrew = true;
          slotError = err;
        }
        break;
      case 'error':
        try {
          self.onerror?.(event as unknown as ErrorEvent);
        } catch (err) {
          slotThrew = true;
          slotError = err;
        }
        break;
      case 'retrying':
        try {
          self.onretrying?.(event as unknown as RetryingEvent);
        } catch (err) {
          slotThrew = true;
          slotError = err;
        }
        break;
      default:
        break;
    }

    // We do this to avoid throwing the error synchronously which could disrupt the running
    // handler. Instead, we queue the throw to run sychronously after the last handler runs.
    // This is also consistent with NodeJS EventEmitter.
    if (slotThrew) {
      queueMicrotask(() => {
        throw slotError;
      });
    }

    // A registered listener that throws must not disrupt the stream's own control flow. A
    // synchronous throw here would skip the reconnect logic in the caller, or turn into a
    // false transport error inside the read loop. The exception surfaces later,
    // asynchronously, exactly like a slot exception.
    try {
      registry.dispatch(event.type as string, event);
    } catch (err) {
      queueMicrotask(() => {
        throw err;
      });
    }
  };

  // Builds common headers
  const makeHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (!config.skipDefaultHeaders) {
      headers['Cache-Control'] = 'no-cache';
      headers.Accept = 'text/event-stream';
    }
    if (config.headers) {
      Object.keys(config.headers).forEach((key) => {
        // The live id below is the only source of this header. The filter covers every case
        // variant of the key; a copied caller variant would otherwise combine with the live
        // value into one joined, invalid id on the wire.
        if (key.toLowerCase() === 'last-event-id') {
          return;
        }
        const value = config.headers[key];
        if (value === undefined) {
          return;
        }
        // A caller key replaces an already-set header with the same name in any case form.
        // Without the removal, a caller's `accept` and the default `Accept` would both go to
        // the transport as two separate headers.
        const existingKey = Object.keys(headers).find(
          (existing) => existing.toLowerCase() === key.toLowerCase(),
        );
        if (existingKey !== undefined && existingKey !== key) {
          delete headers[existingKey];
        }
        // `fetch()` accepts only strings. The client sends a multi-valued header as one
        // comma-joined value. HTTP defines that form as equivalent to a repeated field.
        headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
      });
    }
    // A caller-supplied Last-Event-ID header only seeds the initial resume point, read in the
    // constructor; each received event id replaces it. An empty id: field from the server
    // clears the id, and then no header is sent.
    if (lastEventId) {
      headers['Last-Event-ID'] = lastEventId;
    }
    return headers;
  };

  const receivedEvent = (event: MessageEvent): void => {
    // The reset interval measures how long the current connection has been delivering
    // data, so the "good since" time is anchored to the first event of each connection.
    if (!goodSinceAnchored) {
      goodSinceAnchored = true;
      try {
        // A throwing strategy must not disrupt event delivery. The exception still reaches
        // the host asynchronously, like a throwing listener's.
        retryDelayStrategy.setGoodSince(new Date().getTime());
      } catch (err) {
        queueMicrotask(() => {
          throw err;
        });
      }
    }
    emit(event);
  };

  // The parser is created once and reset on each connection attempt. The read loop stops
  // feeding it once a new attempt supersedes an old one. A generation mismatch inside a
  // callback means a listener called close() while a chunk was mid-parse, and the rest of
  // that chunk must not commit state or dispatch events.
  let parserGeneration = 0;

  const parser = createParser({
    onId: (id) => {
      if (parserGeneration !== generation) {
        return;
      }
      // The parser reports the id at the blank line that ends a block, even when the block has
      // no data. A committed id from an id-only block is the resume point for a reconnect.
      // An id that fails this test would make the Last-Event-ID header assignment throw on
      // reconnect. See INVALID_HEADER_VALUE_CHAR for the rule and its rationale.
      if (!INVALID_HEADER_VALUE_CHAR.test(id)) {
        lastEventId = id;
      }
    },
    onRetry: (retry) => {
      if (parserGeneration !== generation) {
        return;
      }
      // The parser only reports a value that is all ASCII digits. The cap keeps a huge value
      // from acting as a permanent stop.
      const delay =
        retry > MAX_SERVER_DIRECTED_RETRY_DELAY_MILLIS
          ? MAX_SERVER_DIRECTED_RETRY_DELAY_MILLIS
          : retry;
      self.reconnectInterval = delay;
      try {
        // A throwing strategy must not disrupt the parser callback. The exception still
        // reaches the host asynchronously, like a throwing listener's.
        retryDelayStrategy.setBaseDelay(delay);
      } catch (err) {
        queueMicrotask(() => {
          throw err;
        });
      }
    },
    onEvent: (event) => {
      // A listener can call close() while its event dispatches. The close bumps the generation
      // counter, so this check stops every later dispatch from the same chunk.
      if (parserGeneration !== generation) {
        return;
      }
      // The parser reports the id before this callback runs, so lastEventId is already
      // committed when the event forms. The parsed data carries no trailing newline.
      receivedEvent(
        makeEvent(event.event || 'message', {
          data: event.data,
          lastEventId,
          origin: streamOriginUrl,
        }),
      );
    },
  });

  const clearReadTimeout = (): void => {
    if (readTimeoutHandle !== undefined) {
      clearTimeout(readTimeoutHandle);
      readTimeoutHandle = undefined;
    }
  };

  const destroyRequest = (): void => {
    // The counter increases here, not only in connect(). Thus close() also invalidates each
    // callback that is still in flight for the attempt under teardown.
    generation += 1;
    clearReadTimeout();
    // Each teardown path goes through here: close(), the read timeout, and a superseded attempt.
    // Thus the current fetch and its response-body reader are always released, and do not
    // accumulate across reconnects.
    abortController?.abort();
    abortController = undefined;
  };

  // The read timeout measures the gap between chunks, independent of the transport. The timer
  // arms when the request starts, and it arms again on each chunk. When the timer fires, no data
  // arrived for the full interval, and the connection is treated as dead.
  const resetReadTimeout = (failOnce: (error?: RawErrorPayload) => void): void => {
    clearReadTimeout();
    const timeout = config.readTimeoutMillis;
    if (!timeout) {
      return;
    }
    readTimeoutHandle = setTimeout(() => {
      try {
        failOnce({
          message: `Read timeout, received no data in ${timeout}ms, assuming connection is dead`,
        });
      } finally {
        // A timeout does not cancel the request. The abort releases the connection and the
        // reader, so they do not leak across reconnects. The finally block keeps that release
        // in place even when an errorFilter exception escapes failOnce.
        destroyRequest();
      }
    }, timeout);
  };

  const connect = (): void => {
    generation += 1;
    const thisGeneration = generation;

    // This releases the remains of a previous attempt. An error status or an ended stream can
    // leave an unread body, and that body would hold the connection open. The release comes after
    // the generation increase, so the callbacks of the previous attempt see that a new attempt
    // replaced them.
    abortController?.abort();
    clearReadTimeout();

    // Each request should be able to fail at most once. The wrapper also stops a stale report
    // from an old attempt, and it is defined before urlBuilder runs, so a throw from urlBuilder
    // is reported as a usual connection failure.
    const failOnce = once((error?: RawErrorPayload) => {
      if (thisGeneration !== generation) {
        return;
      }
      clearReadTimeout();
      // failed() schedules a reconnect that calls connect() again, so these three functions form
      // a cycle; some edge in it has to be a forward reference.
      // eslint-disable-next-line no-use-before-define
      failed(error);
    });

    // Each attempt can require a new URL, for example when a query parameter changes between
    // reconnects. The builder runs for the first connection and for reconnects.
    if (config.urlBuilder) {
      try {
        currentUrl = config.urlBuilder();
      } catch (err) {
        failOnce({ message: (err as Error)?.message ?? 'urlBuilder failed' });
        return;
      }
    }

    const callback = (res: FetchResponse): void => {
      if (thisGeneration !== generation) {
        return;
      }

      const responseHeaders = headersToObject(res.headers);

      // A real fetch() has followed each redirect before this point, and an injected transport
      // that does not follow redirects surfaces the redirect status itself. Thus each status
      // other than 200 is a failure. This includes a 301 or 307 without a Location header, which
      // fetch() cannot follow.
      if (res.status !== 200) {
        failOnce({
          status: res.status,
          headers: responseHeaders,
          message: res.statusText,
        });
        // This path never reads the body. The abort in destroyRequest() releases the body and
        // its connection. The Fetch standard specifies this: the abort algorithm from a `fetch()`
        // call also errors the response body stream, not only the request.
        destroyRequest();
        return;
      }

      // A 200 response must carry an event-stream content type; any other declared type (an
      // HTML error page, a JSON body from a misconfigured proxy) is a failure, not a stream to
      // parse. The media type must match exactly; parameters after it, such as a charset, are
      // allowed. A response with no Content-Type header at all is accepted, because a minimal
      // injected transport can omit response headers.
      const contentTypeKey = Object.keys(responseHeaders).find(
        (key) => key.toLowerCase() === 'content-type',
      );
      const contentType =
        contentTypeKey === undefined ? undefined : responseHeaders[contentTypeKey];
      if (
        contentType !== undefined &&
        contentType.split(';', 1)[0].trim().toLowerCase() !== 'text/event-stream'
      ) {
        failOnce({
          status: res.status,
          headers: responseHeaders,
          message: `unexpected Content-Type '${contentType}', expected 'text/event-stream'`,
        });
        destroyRequest();
        return;
      }

      if (!res.body) {
        failOnce({ message: 'stream response has no body' });
        destroyRequest();
        return;
      }

      // The final response URL wins when the transport reports one; the request URL is the
      // fallback for a minimal transport that does not.
      streamOriginUrl = resolveStreamOrigin(res.url || currentUrl);

      // The reset scopes all parser state to one connection. It drops any partial line that a
      // previous connection left behind.
      parser.reset();
      parserGeneration = thisGeneration;
      goodSinceAnchored = false;

      readyState = OPEN;
      resetReadTimeout(failOnce);
      emit(makeEvent('open', { headers: responseHeaders }));

      const reader = res.body.getReader();
      // The decoder carries a multi-byte sequence that splits across reads. Each connection
      // gets a fresh decoder, so a partial sequence from a dropped connection cannot leak into
      // the next one. The decoder also removes the one encoded byte order mark that the SSE
      // specification ignores at the start of the stream. The parser removes a decoded one.
      const decoder = new TextDecoder();
      const readLoop = async (): Promise<void> => {
        try {
          for (;;) {
            // The reads are sequential: the code cannot request the next chunk until this chunk
            // arrives.
            // eslint-disable-next-line no-await-in-loop
            const { done, value } = await reader.read();
            if (thisGeneration !== generation) {
              return;
            }
            if (done) {
              // The server ended the stream. The report has no payload. failed() turns a report
              // with no payload into an `end` event, not an `error`.
              failOnce();
              return;
            }
            resetReadTimeout(failOnce);
            if (value) {
              parser.feed(decoder.decode(value, { stream: true }));
            }
          }
        } catch (err) {
          if (thisGeneration !== generation) {
            return;
          }
          failOnce({ message: (err as Error)?.message ?? 'stream read failed' });
        }
      };
      // No await: readLoop reports its own outcome through failOnce and never rejects.
      readLoop();
    };

    const controller = new AbortController();
    abortController = controller;

    const method = config.method ?? 'GET';
    const init: FetchRequestOptions = {
      method,
      headers: makeHeaders(),
      signal: controller.signal,
    };
    if (config.withCredentials) {
      init.credentials = 'include';
    }
    // A `fetch()` request with GET or HEAD cannot have a body. A body causes a TypeError.
    if (config.body !== undefined && !bodylessMethods.includes(method.toUpperCase())) {
      init.body = config.body;
    }

    // The timer starts before the request. Thus the read timeout also applies to a connection
    // that never produces a response.
    resetReadTimeout(failOnce);

    try {
      doFetch(currentUrl, init)
        .then(callback)
        .catch((err) => failOnce({ message: (err as Error)?.message ?? 'stream request failed' }));
    } catch (err) {
      // fetch() can throw an argument error synchronously, not as a rejected promise.
      failOnce({ message: (err as Error)?.message ?? 'stream request failed' });
    }
  };

  const scheduleReconnect = (): void => {
    if (readyState !== CONNECTING) {
      return;
    }
    let delay: number;
    try {
      delay = retryDelayStrategy.nextRetryDelay(new Date().getTime());
    } catch (err) {
      // A throwing strategy cannot supply a delay. The reconnect continues with the last
      // known reconnect interval, so caller code cannot strand the connection state.
      // The exception still reaches the host asynchronously, like a throwing listener's.
      queueMicrotask(() => {
        throw err;
      });
      delay = self.reconnectInterval;
    }

    emit(makeEvent('retrying', { delayMillis: delay }));

    // A retrying listener can call close(). close() moves the state to CLOSED and clears the
    // timer, so a new timer must not arm after it.
    if (readyState !== CONNECTING) {
      return;
    }

    clearTimeout(reconnectTimer);

    reconnectTimer = setTimeout(() => {
      if (readyState !== CONNECTING) {
        return;
      }
      connect();
    }, delay);
  };

  const failed = (error?: RawErrorPayload): void => {
    if (readyState === CLOSED) {
      return;
    }
    // The event's message is always a string; a transport failure without a status message
    // defaults to an empty string.
    const errorEvent = error
      ? makeEvent('error', { ...error, message: error?.message ?? '' })
      : makeEvent('end', { message: 'the request completed unexpectedly' });
    let shouldRetry: boolean;
    try {
      shouldRetry = (config.errorFilter || defaultErrorFilter)(errorEvent as unknown as ErrorEvent);
    } catch (err) {
      // A throwing filter cannot decide, so the stream stops cleanly instead of leaking the
      // connection or stranding the state. The exception still reaches the host asynchronously,
      // like a throwing listener's.
      queueMicrotask(() => {
        throw err;
      });
      shouldRetry = false;
    }
    // The filter can call close(). That close is final: the state must not move back to
    // CONNECTING, and no further event dispatches for this failure.
    if (readyState === CLOSED) {
      return;
    }
    if (shouldRetry) {
      readyState = CONNECTING;
      emit(errorEvent);
      scheduleReconnect();
    } else {
      emit(errorEvent);
      // An error listener can also call close(). close() has already dispatched `closed` and
      // released the request, so a second teardown here would dispatch `closed` twice.
      if (readyState === CLOSED) {
        return;
      }
      readyState = CLOSED;
      // The stream ends here and a later close() is a no-op once the state is CLOSED, so this
      // is the last place that can release the connection and any pending read.
      destroyRequest();
      emit(makeEvent('closed'));
    }
  };

  // Ensure the API surface is what we expect.
  const hiddenMembers: {
    [K in Exclude<keyof EventSource, OwnSlots>]: TypedPropertyDescriptor<EventSource[K]> & {
      enumerable: false;
      configurable: true;
    };
  } = {
    readyState: {
      enumerable: false,
      configurable: true,
      get(): number {
        return readyState;
      },
    },
    url: {
      enumerable: false,
      configurable: true,
      get(): string {
        return currentUrl;
      },
    },
    addEventListener: {
      enumerable: false,
      configurable: true,
      writable: true,
      value: function addEventListener(type: string, listener: (event: any) => void): void {
        if (typeof listener === 'function') {
          registry.addEventListener(type, listener);
        }
      },
    },
    removeEventListener: {
      enumerable: false,
      configurable: true,
      writable: true,
      value: function removeEventListener(type: string, listener: (event: any) => void): void {
        if (typeof listener === 'function') {
          registry.removeEventListener(type, listener);
        }
      },
    },
    close: {
      enumerable: false,
      configurable: true,
      writable: true,
      value: function close(): void {
        clearTimeout(reconnectTimer);

        if (readyState === CLOSED) {
          return;
        }
        readyState = CLOSED;

        destroyRequest();

        try {
          self.onclose?.();
        } finally {
          emit(makeEvent('closed'));
        }
      },
    },
  };

  Object.defineProperties(self, hiddenMembers);

  connect();

  return self;
}
