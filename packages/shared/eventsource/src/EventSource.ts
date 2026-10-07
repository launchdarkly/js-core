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
  RetryEvent,
} from './Event';
import {
  bodylessMethods,
  defaultFetch,
  headersToObject,
  INVALID_HEADER_VALUE_CHAR,
  splitHeaderListValue,
} from './httpHelpers';
import { createDefaultEventRegistry } from './listenerRegistry';
import { createParser } from './parser';
import * as retryDelay from './retryDelay';
import { monotonicNow } from './timer';
import {
  EventListenerRegistry,
  EventSourceInitDict,
  FetchBodyReader,
  FetchLike,
  FetchLikeOptions,
  FetchLikeResponse,
} from './types';

/** Ready state: a connection attempt is in progress, or a reconnect wait is in progress. */
export const CONNECTING = 0;

/** Ready state: the connection is open and events can be delivered. */
export const OPEN = 1;

/** Ready state: `close()` has closed the connection; it will not reconnect. */
export const CLOSED = 2;

// A server-directed `retry:` value larger than this is treated as this value. A larger value
// would be indistinguishable from the connection never resuming. The cap also keeps the
// reconnect delay far below the runtime timer limit, which some runtimes replace with a
// near-zero delay.
const MAX_SERVER_DIRECTED_RETRY_DELAY_MILLIS = 60 * 60 * 1000;

function once<T extends (...args: any[]) => void>(cb: T): (...args: Parameters<T>) => void {
  let called = false;
  return (...params: Parameters<T>) => {
    if (!called) {
      called = true;
      cb(...params);
    }
  };
}

/**
 * Reads an error's message for a failure report. A hostile error can throw from its own message
 * getter, or carry a non-string value, and a failure report must never throw while it forms.
 */
function safeErrorMessage(err: unknown, fallback: string): string {
  try {
    const message = (err as Error)?.message;
    return typeof message === 'string' ? message : fallback;
  } catch {
    return fallback;
  }
}

function defaultErrorFilter(error: ErrorEvent): boolean {
  if (error.status) {
    const s = error.status;
    return s === 500 || s === 502 || s === 503 || s === 504;
  }
  // A report with no status (an I/O error, a timeout, an ended stream) always retries.
  return true;
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
   * strategy owns the actual reconnect timing; this slot only supplies the fallback delay for a
   * reconnect whose strategy call throws, validated and capped at one hour at that point.
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
  onretrying: ((event: RetryEvent) => void) | undefined;

  /**
   * Called once when `close()` closes the stream, before the listeners registered for the
   * `closed` event. Only the public `close()` method invokes it. An internal non-retryable
   * termination dispatches the `error` and `closed` events without it, because the `errorFilter`
   * caller already received that error. A server-sent SSE frame named `closed` reaches only the
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
   * Invokes `onclose` and dispatches the `closed` event. This function is idempotent.
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
  // The origin that message events report. Each connection computes it in the response
  // callback, because urlBuilder can pick a new URL between reconnects and the transport can
  // follow redirects.
  let streamOriginUrl = '';
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

  // The transport is injectable. `defaultFetch` documents the default behavior.
  const doFetch: FetchLike = config.fetch ?? defaultFetch;

  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  /** Aborts the current request. Each connection attempt replaces this controller. */
  let abortController: AbortController | undefined;

  /** The reader of the current response body, kept so teardown can release it. */
  let activeReader: FetchBodyReader | undefined;

  let readTimeoutHandle: ReturnType<typeof setTimeout> | undefined;

  /**
   * Each connection attempt increases this counter, and each transition to CLOSED increases it
   * through destroyRequest(). A read loop, a `fetch()` promise, or a failure path from an old
   * attempt compares its own generation against this counter and stops. A mismatch means the
   * attempt is superseded or the stream is closed; both are reasons to stop.
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
   * Dispatches one event. The matching `on*` slot runs first, then the listeners registered
   * for the event's type.
   *
   * A server-sent SSE frame whose `event:` name is `open`, `error`, or `retrying` also reaches
   * the matching slot, with the frame's `MessageEvent` payload, exactly as it reaches the
   * registered listeners of that type.
   *
   * @remark
   * The `closed` type has no slot case on purpose. Only `close()` invokes `onclose`, so neither
   * a data frame nor an internal termination can look like a user-initiated close.
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
          self.onretrying?.(event as unknown as RetryEvent);
        } catch (err) {
          slotThrew = true;
          slotError = err;
        }
        break;
      default:
        break;
    }

    // The throw is queued so it cannot disrupt the running handler or the stream's own control
    // flow. It surfaces later, on a separate microtask, as an uncaught error in the host.
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

  // Each attempt builds its headers again, because the live Last-Event-ID changes between
  // attempts.
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
    // A caller-supplied Last-Event-ID header only seeds the initial resume point, which
    // createEventSource reads once. Each received event id replaces it. An empty `id:` field
    // from the server clears the id, and then no header is sent.
    if (lastEventId) {
      headers['Last-Event-ID'] = lastEventId;
    }
    return headers;
  };

  // The parser is created once and reset on each connection attempt. The read loop stops
  // feeding it once a new attempt supersedes an old one. A generation mismatch inside a
  // callback means a listener called close() while a chunk was mid-parse, and the rest of
  // that chunk must not commit state or dispatch events.
  let parserGeneration = 0;

  const receivedEvent = (event: MessageEvent): void => {
    // The reset interval measures how long the current connection has been delivering
    // data, so the "good since" time is anchored to the first event of each connection.
    if (!goodSinceAnchored) {
      goodSinceAnchored = true;
      try {
        // A throwing strategy must not disrupt event delivery. The exception still reaches
        // the host asynchronously, like a throwing listener's.
        retryDelayStrategy.setGoodSince(monotonicNow());
      } catch (err) {
        queueMicrotask(() => {
          throw err;
        });
      }
    }
    // A strategy can call close() from inside setGoodSince. No event dispatches after a close.
    if (parserGeneration !== generation) {
      return;
    }
    emit(event);
  };

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
      // The parser only reports a value that is all ASCII digits. The parser already caps the
      // value; this cap repeats it, so the client does not depend on a change made in the
      // parser fork.
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

  // Returns the generation that this teardown produced. The abort below can run caller code (an
  // abort listener on the signal), and that code can call close(), which increases the counter
  // again. The return value lets failOnce() detect that close.
  const destroyRequest = (): number => {
    // The counter increases here, not only in connect(). Every transition to CLOSED runs through
    // here, so close() invalidates each callback that is still in flight for the attempt under
    // teardown, and a generation comparison also detects a closed stream.
    generation += 1;
    const teardownGeneration = generation;
    clearReadTimeout();
    // Every teardown path that can leave a live connection runs through here. Thus the current
    // fetch and its response-body reader are always released, and they do not accumulate across
    // reconnects.
    abortController?.abort();
    abortController = undefined;
    // The abort is advisory for an injected transport. A transport that ignores the signal
    // would keep the read loop and its connection alive, so the cancel releases both for every
    // transport. A failing cancel has nothing left to release, and its rejection only restates
    // the abort.
    try {
      const cancelResult = activeReader?.cancel?.();
      if (cancelResult) {
        Promise.resolve(cancelResult).catch(() => {});
      }
    } catch {
      // A throwing cancel has nothing left to release.
    }
    activeReader = undefined;
    return teardownGeneration;
  };

  /** Releases a response body that the client rejects without reading. */
  const releaseBody = (res: FetchLikeResponse): void => {
    try {
      const cancelResult = res.body?.cancel?.();
      if (cancelResult) {
        Promise.resolve(cancelResult).catch(() => {});
      }
    } catch {
      // A throwing cancel has nothing left to release.
    }
  };

  // The read timeout measures the gap between chunks, independent of the transport. The timer
  // arms when the request starts, and it arms again on each chunk that carries bytes. When the
  // timer fires, no data arrived for the full interval, and the connection is treated as dead.
  const resetReadTimeout = (failOnce: (error?: RawErrorPayload) => void): void => {
    clearReadTimeout();
    const timeout = config.readTimeoutMillis;
    if (!timeout) {
      return;
    }
    readTimeoutHandle = setTimeout(() => {
      // A timeout does not cancel the request. The teardown inside failOnce releases the
      // connection and the reader, so they do not leak across reconnects.
      failOnce({
        message: `Read timeout, received no data in ${timeout}ms, assuming connection is dead`,
      });
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
    // is reported as a usual connection failure. The wrapper owns the teardown: every failure
    // releases the connection here, before the failure dispatch, so no call site needs its own
    // destroyRequest() call.
    const failOnce = once((error?: RawErrorPayload) => {
      if (thisGeneration !== generation) {
        return;
      }
      // The teardown increases the generation, so the token below is the post-teardown value.
      // The token stays valid until close() or the next connect() increases the counter again.
      // An abort listener can call close() during the teardown; the returned token then differs
      // from the counter, and failed() stops.
      const failureGeneration = destroyRequest();
      // failed() schedules a reconnect that calls connect() again, so these three functions form
      // a cycle; some edge in it has to be a forward reference.
      // eslint-disable-next-line no-use-before-define
      failed(failureGeneration, error);
    });

    // Each attempt can require a new URL, for example when a query parameter changes between
    // reconnects. The builder runs for the first connection and for reconnects.
    if (config.urlBuilder) {
      try {
        currentUrl = config.urlBuilder();
      } catch (err) {
        failOnce({ message: safeErrorMessage(err, 'urlBuilder failed') });
        return;
      }
      // The builder can call close(), and close() bumps the generation counter. A request must
      // not start for a stream that is already closed.
      if (thisGeneration !== generation) {
        return;
      }
    }

    const callback = (res: FetchLikeResponse): void => {
      if (thisGeneration !== generation) {
        // The abort is advisory for an injected transport, so a response that resolves after
        // close() or after a newer attempt gets its body released here, as the later stale
        // checks do.
        releaseBody(res);
        return;
      }

      // A hostile headers object must not break the failure report. Without the fallback, a
      // non-200 status would be lost with the throw, and the error filter could not classify
      // the failure.
      let responseHeaders: Record<string, string>;
      let headersUnreadable = false;
      try {
        responseHeaders = headersToObject(res.headers);
      } catch {
        responseHeaders = {};
        headersUnreadable = true;
      }

      // The status is read once. A getter that changes its answer between reads would skew the
      // classification, and a throw on a later read would skip the release below.
      const { status } = res;

      // A real fetch() has followed each redirect before this point, and an injected transport
      // that does not follow redirects surfaces the redirect status itself. Thus each status
      // other than 200 is a failure. This includes a 301 or 307 without a Location header, which
      // fetch() cannot follow.
      if (status !== 200) {
        // The guarded read keeps the failure report intact when the statusText getter throws.
        let statusText: string;
        try {
          const raw: unknown = res.statusText;
          statusText = typeof raw === 'string' ? raw : '';
        } catch {
          statusText = '';
        }
        failOnce({
          status,
          headers: responseHeaders,
          message: statusText,
        });
        // This path never reads the body. For a standard fetch, the abort inside failOnce's
        // teardown errors the body stream per the Fetch standard; the explicit release covers a
        // transport that ignores the abort signal.
        releaseBody(res);
        return;
      }

      if (headersUnreadable) {
        // On a success status the headers decide whether the body is a stream at all. A 200
        // whose headers cannot be read must fail and retry, not open as a headerless stream
        // with its partially collected headers discarded.
        failOnce({ message: 'stream response headers could not be read' });
        releaseBody(res);
        return;
      }

      // A 200 response must carry an event-stream content type. Any other declared type (an
      // HTML error page, a JSON body from a misconfigured proxy) is a failure, not a stream to
      // parse. A response with no Content-Type header is accepted, because a minimal injected
      // transport can report no headers.
      //
      // The media type must match exactly. Parameters after it, such as a charset, are allowed.
      // A standard Headers object comma-joins a duplicated Content-Type header, so each part of
      // a joined value must declare the event-stream media type. This is stricter than the
      // Fetch algorithm, which keeps only the last parsable part, and an empty or unparsable
      // part also fails.
      //
      // trim() also strips NBSP, form feed, and vertical tab, which are not HTTP whitespace.
      // The extra leniency is harmless.
      const contentType = responseHeaders['content-type'];
      if (
        contentType !== undefined &&
        !splitHeaderListValue(contentType).every(
          (part) => part.split(';', 1)[0].trim().toLowerCase() === 'text/event-stream',
        )
      ) {
        // The 200 status stays out of the report on purpose. Error filters classify HTTP error
        // statuses, and a 200 would read as a permanent failure. A wrong declared type is a
        // transient transport condition (an intercepting proxy, a captive portal), so the
        // report stays retryable, like a transport failure.
        failOnce({
          headers: responseHeaders,
          message: `unexpected Content-Type '${contentType}', expected 'text/event-stream'`,
        });
        releaseBody(res);
        return;
      }

      if (!res.body) {
        failOnce({ message: 'stream response has no body' });
        return;
      }

      // The final response URL wins when the transport reports one; the request URL is the
      // fallback for a minimal transport that does not.
      streamOriginUrl = resolveStreamOrigin(res.url || currentUrl);

      // A transport accessor above can call close(), and close() bumps the generation. A closed
      // stream must not move back to OPEN or emit open after its closed event.
      if (thisGeneration !== generation) {
        releaseBody(res);
        return;
      }

      // The reset scopes all parser state to one connection. It drops any partial line that a
      // previous connection left behind.
      parser.reset();
      parserGeneration = thisGeneration;
      goodSinceAnchored = false;

      readyState = OPEN;
      resetReadTimeout(failOnce);
      emit(makeEvent('open', { headers: responseHeaders }));

      // An open listener can call close(), and close() bumps the generation. A reader created
      // after that would belong to a closed stream, and nothing would ever cancel it.
      if (thisGeneration !== generation) {
        releaseBody(res);
        return;
      }

      let reader: FetchBodyReader;
      try {
        reader = res.body.getReader();
      } catch (err) {
        // A standard body throws here only when the stream is locked, which this client cannot
        // cause. An injected transport can throw for any reason, and that failure must release
        // the request like every other rejection of the response.
        failOnce({ message: safeErrorMessage(err, 'getReader failed') });
        releaseBody(res);
        return;
      }
      // The body getter and getReader() are the last caller code before the read loop, and
      // either one can call close(). A reader created for a closed stream must be released
      // here, because close() already ran and will not run again.
      if (thisGeneration !== generation) {
        try {
          const cancelResult = reader.cancel?.();
          if (cancelResult) {
            Promise.resolve(cancelResult).catch(() => {});
          }
        } catch {
          // A throwing cancel has nothing left to release.
        }
        releaseBody(res);
        return;
      }
      activeReader = reader;
      // The decoder carries a multi-byte sequence that splits across reads. Each connection
      // gets a fresh decoder, so a partial sequence from a dropped connection cannot leak into
      // the next one. The decoder also removes the one encoded byte order mark that the SSE
      // specification ignores at the start of the stream. The parser removes a decoded one.
      const decoder = new TextDecoder();
      let readsSinceYield = 0;
      const readLoop = async (): Promise<void> => {
        try {
          for (;;) {
            // The reads are sequential. The loop cannot request the next chunk until this
            // chunk arrives.
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
            if (value) {
              // decode() is the BufferSource validator. It accepts every binary shape, including
              // a buffer from another realm (vm, iframe, Electron context) and a
              // SharedArrayBuffer, and it rejects anything else, so a transport that supplies a
              // non-binary chunk fails loudly and never stalls the stream silently.
              let text: string;
              try {
                text = decoder.decode(value, { stream: true });
              } catch {
                // The engine's message can quote the chunk contents on some runtimes, and
                // stream data must not leak into error events and logs.
                throw new TypeError('the transport supplied a chunk that is not a BufferSource');
              }
              // Only a chunk that carries bytes is proof of liveness. An empty chunk from a
              // hostile or buggy transport must not keep a dead connection alive. The byte count,
              // not the decoded length, is what measures liveness, because a partial multi-byte
              // sequence decodes to an empty string while it still carries real data.
              if (value.byteLength > 0) {
                resetReadTimeout(failOnce);
              }
              if (text) {
                parser.feed(text);
              }
            }
            readsSinceYield += 1;
            if (readsSinceYield >= 1024) {
              readsSinceYield = 0;
              // A transport whose reads resolve synchronously would keep this loop on the
              // microtask queue forever, and no timer (the read timeout, a reconnect, a caller's
              // scheduled close()) could ever run. The periodic pause yields to the macrotask
              // queue.
              // eslint-disable-next-line no-await-in-loop
              await new Promise<void>((resolve) => {
                setTimeout(resolve, 0);
              });
              if (thisGeneration !== generation) {
                return;
              }
            }
          }
        } catch (err) {
          if (thisGeneration !== generation) {
            return;
          }
          // A retried read failure only arms a reconnect timer, and nothing else would release
          // the broken connection until that timer fires. The teardown inside failOnce frees the
          // connection and the reader now, as the read-timeout path does.
          failOnce({ message: safeErrorMessage(err, 'stream read failed') });
        }
      };
      // The call is not awaited. readLoop reports its own outcome through failOnce and never
      // rejects.
      readLoop();
    };

    const controller = new AbortController();
    abortController = controller;

    const method = config.method ?? 'GET';
    const init: FetchLikeOptions = {
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
        .catch((err) => {
          // A slow transport can reject this attempt's promise after a newer attempt has
          // already started. The release below acts on the live attempt's state, so a stale
          // rejection must not reach it.
          if (thisGeneration !== generation) {
            return;
          }
          // A throw that escapes the response callback (a hostile response getter) would leave
          // the request held until the reconnect. The teardown inside failOnce releases it. The
          // release is harmless for an ordinary network rejection, where no connection exists.
          failOnce({ message: safeErrorMessage(err, 'stream request failed') });
        });
    } catch (err) {
      // fetch() can throw an argument error synchronously, not as a rejected promise.
      failOnce({ message: safeErrorMessage(err, 'stream request failed') });
    }
  };

  // The failure generation threads in from failed(). A close() during the error dispatch in
  // failed() increases the counter before this function runs, and a snapshot taken here would
  // miss it.
  const scheduleReconnect = (failureGeneration: number): void => {
    if (failureGeneration !== generation) {
      return;
    }
    let delay: number;
    try {
      delay = retryDelayStrategy.nextRetryDelay(monotonicNow());
    } catch (err) {
      // A throwing strategy cannot supply a delay. The reconnect continues with the last
      // known reconnect interval, so caller code cannot strand the connection state.
      // The exception still reaches the host asynchronously, like a throwing listener's.
      queueMicrotask(() => {
        throw err;
      });
      // The slot is caller-writable, so the value is validated here. A value that is not a
      // non-negative finite number becomes the default initial delay, and the one-hour cap
      // applies as it does to a server-directed value.
      const fallback = self.reconnectInterval;
      if (Number.isFinite(fallback) && fallback >= 0) {
        delay = Math.min(fallback, MAX_SERVER_DIRECTED_RETRY_DELAY_MILLIS);
      } else {
        delay = 1000;
      }
    }

    emit(makeEvent('retrying', { delayMillis: delay }));

    // A retrying listener can call close(). close() increases the generation and clears the
    // timer, so a new timer must not arm after it.
    if (failureGeneration !== generation) {
      return;
    }

    clearTimeout(reconnectTimer);

    reconnectTimer = setTimeout(() => {
      // Only close() can increase the generation while the timer is armed, and close() also
      // clears the timer. The check stays as a second line of defense.
      if (failureGeneration !== generation) {
        return;
      }
      connect();
    }, delay);
  };

  // The failure generation is the token that failOnce's teardown produced. A counter that moved
  // past it means the stream closed during the teardown, and the failure dispatch must not run.
  const failed = (failureGeneration: number, error?: RawErrorPayload): void => {
    if (failureGeneration !== generation) {
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
    // The filter can call close(), and that close is final. close() increases the generation,
    // so the state must not move back to CONNECTING, and no further event dispatches for this
    // failure.
    if (failureGeneration !== generation) {
      return;
    }
    if (shouldRetry) {
      readyState = CONNECTING;
      emit(errorEvent);
      scheduleReconnect(failureGeneration);
    } else {
      // This follows the W3C ordering. The state is already CLOSED when the error listeners
      // run, so a listener's own close() call is a no-op.
      readyState = CLOSED;
      emit(errorEvent);
      // The teardown in failOnce already released the connection. This call keeps the rule
      // that every transition to CLOSED increases the generation.
      destroyRequest();
      emit(makeEvent('closed'));
    }
  };

  // The accessors and methods stay non-enumerable. The mapped type makes the compiler reject
  // a missing or extra member.
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
