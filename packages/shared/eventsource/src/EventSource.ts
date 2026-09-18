/* This implementation is derived from `eventsource.js` of LaunchDarkly's original
 * `launchdarkly-eventsource` (js-eventsource) package, with `fetch()`, `ReadableStream`, and
 * `AbortController` in place of the Node `http` transport. This implementation preserves the
 * parser algorithm and retry behavior of that original package.
 */

import CalculateCapacity from './capacity';
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
import {
  bom,
  carriageReturn,
  colon,
  hasBom,
  INVALID_HEADER_VALUE_CHAR,
  lineFeed,
  MAX_OVER_ALLOCATION,
  space,
  utf8Decoder,
} from './parsing';
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
 * A W3C-compliant EventSource (server-sent events) client built on a `fetch()`-shaped transport,
 * `ReadableStream`, and `AbortController`. Unlike the native browser `EventSource`, an event
 * source built by this package supports request headers, a custom method with a request body,
 * and a read timeout.
 *
 * The SSE behavior stays as close as possible to the behavior of the original
 * `launchdarkly-eventsource` package: the same event names and shapes, the same retry and
 * backoff timing, and the same `text/event-stream` parser algorithm.
 *
 * @remark
 * The Node-only options (`https`, `proxy`, `agent`, `rejectUnauthorized`) do not exist here,
 * because `fetch()` has no equivalent for them; a caller that needs transport control injects
 * a `fetch`-shaped function instead.
 *
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html
 */
export interface EventSource {
  readonly readyState: number;

  readonly url: string;

  /**
   * Mirrors the most recent server `retry:` field, in milliseconds; initially the configured
   * base reconnect delay, before any `retry:` field has arrived. The retry strategy owns the
   * actual reconnect timing; writing to this slot has no effect on it.
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
   * Invokes `onclose` and dispatches the `closed` event, once; later calls do nothing. The
   * `closed` event still dispatches even when `onclose` throws, so a throwing `onclose` cannot
   * permanently starve the `closed` listeners; the exception propagates to the caller of
   * `close()` after that dispatch runs. When both `onclose` and a `closed` listener throw, the
   * listener's exception is the one that propagates: standard `try`/`finally` semantics let the
   * later exception replace the earlier one.
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
  if (config.headers && config.headers['Last-Event-ID']) {
    lastEventId = config.headers['Last-Event-ID'] as string;
  }

  let discardTrailingNewline = false;
  let data = '';
  let eventName: string | undefined;
  let eventId: string | undefined;

  // RetryDelayStrategy is a factory function, not a class; the call takes no `new`.
  const retryDelayStrategy = retryDelay.RetryDelayStrategy(
    config.initialRetryDelayMillis !== null && config.initialRetryDelayMillis !== undefined
      ? config.initialRetryDelayMillis
      : 1000,
    config.retryResetIntervalMillis,
    config.maxBackoffMillis ? retryDelay.defaultBackoff(config.maxBackoffMillis) : null,
    config.jitterRatio ? retryDelay.defaultJitter(config.jitterRatio) : null,
  );

  const streamOriginUrl = new URL(url).origin;

  // The transport is injectable. `defaultFetch` documents the default behavior.
  const doFetch: FetchFn = config.fetch ?? defaultFetch;

  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  /** Aborts the current request. Each connection attempt replaces this controller. */
  let abortController: AbortController | undefined;

  let readTimeoutHandle: ReturnType<typeof setTimeout> | undefined;

  /**
   * Each connection attempt increases this counter. A read loop, or a `fetch()` promise, from an
   * old attempt compares its own generation against this counter and stops. Thus a stale response
   * cannot feed the parser, and cannot report a failure for the current attempt. The check exists
   * because a promise continuation cannot be detached the way an event listener can; this
   * comparison is the teardown.
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
   * registered listeners of that type. There is no case for `closed` on purpose: only `close()`
   * invokes `onclose`, so neither a data frame nor an internal termination can look like a
   * user-initiated close.
   *
   * An exception from the matching slot cannot reach this function's own caller. Uncaught, that
   * exception would skip the registry dispatch below, and it would also skip whatever the
   * caller does right after `emit` returns: `scheduleReconnect()` after `failed()`'s emit, the
   * read loop's start after the `open` emit, and the reconnect timer's arming after the
   * `retrying` emit. This function catches the exception instead, queues it to rethrow on a later
   * microtask so it still reaches the host as an uncaught error, and then runs the registry
   * dispatch regardless of the slot's outcome.
   *
   * A registered listener's exception propagates synchronously out of `dispatch`, stopping any
   * later listener for this same event. On dispatches driven by the connection, that exception
   * surfaces as a stream failure or stalls the retry flow.
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
    if (slotThrew) {
      queueMicrotask(() => {
        throw slotError;
      });
    }
    // `event.type` is stamped by `makeEvent` and is always present at runtime; the payload
    // interfaces declare it optional only because a caller constructing one directly does not
    // need to supply it.
    registry.dispatch(event.type as string, event);
  };

  // A `fetch()` request has no options object of the same kind, so this function builds only the
  // headers.
  const makeHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (!config.skipDefaultHeaders) {
      headers['Cache-Control'] = 'no-cache';
      headers.Accept = 'text/event-stream';
    }
    if (lastEventId) {
      headers['Last-Event-ID'] = lastEventId;
    }
    if (config.headers) {
      Object.keys(config.headers).forEach((key) => {
        const value = config.headers[key];
        if (value === undefined) {
          return;
        }
        // `fetch()` accepts only strings. The client sends a multi-valued header as one
        // comma-joined value. HTTP defines that form as equivalent to a repeated field.
        headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
      });
    }
    return headers;
  };

  const receivedEvent = (event: MessageEvent): void => {
    retryDelayStrategy.setGoodSince(new Date().getTime());
    emit(event);
  };

  const parseEventStreamLine = (
    buf: Uint8Array,
    pos: number,
    fieldLength: number,
    lineLength: number,
  ): void => {
    if (lineLength === 0) {
      if (data.length > 0) {
        const type = eventName || 'message';
        if (eventId !== undefined) {
          lastEventId = eventId;
        }
        const event = makeEvent(type, {
          data: data.slice(0, -1), // remove trailing newline
          lastEventId,
          origin: streamOriginUrl,
        });
        data = '';
        eventId = undefined;
        receivedEvent(event);
      }
      eventName = undefined;
    } else {
      const noValue = fieldLength < 0;
      let step = 0;
      const field = utf8Decoder.decode(
        buf.subarray(pos, pos + (noValue ? lineLength : fieldLength)),
      );

      if (noValue) {
        step = lineLength;
      } else if (buf[pos + fieldLength + 1] !== space) {
        step = fieldLength + 1;
      } else {
        step = fieldLength + 2;
      }
      const valueStart = pos + step;

      const valueLength = lineLength - step;
      const value = utf8Decoder.decode(buf.subarray(valueStart, valueStart + valueLength));

      if (field === 'data') {
        data += `${value}\n`;
      } else if (field === 'event') {
        eventName = value;
      } else if (field === 'id') {
        // An id that fails this test would make the Last-Event-ID header assignment throw on
        // reconnect. See INVALID_HEADER_VALUE_CHAR for the rule and its rationale.
        if (!INVALID_HEADER_VALUE_CHAR.test(value)) {
          eventId = value;
        }
      } else if (field === 'retry') {
        const retry = parseInt(value, 10);
        if (!Number.isNaN(retry)) {
          self.reconnectInterval = retry;
          retryDelayStrategy.setBaseDelay(retry);
        }
      }
    }
  };

  const clearReadTimeout = (): void => {
    if (readTimeoutHandle !== undefined) {
      clearTimeout(readTimeoutHandle);
      readTimeoutHandle = undefined;
    }
  };

  const destroyRequest = (): void => {
    // The counter increases here, not only in connect(). Thus close() also invalidates each
    // callback that is still in flight for the attempt under teardown. An example: a fetch() or a
    // reader.read() that resolved just before close() ran, whose continuation has not run yet.
    // Without the increase, the `generation` captured in that callback would still match. The
    // callback could then set readyState back to open, or deliver a message after the `closed`
    // event.
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
      failOnce({
        message: `Read timeout, received no data in ${timeout}ms, assuming connection is dead`,
      });
      // A timeout does not cancel the request. The abort releases the connection and the reader,
      // so they do not leak across reconnects.
      destroyRequest();
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
    // reconnects. The builder runs for the first connection and for reconnects. This agrees with
    // the platform EventSource that this client replaces.
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

      // A real fetch() has followed each redirect before this point, and an injected transport
      // that does not follow redirects surfaces the redirect status itself. Thus each status
      // other than 200 is a failure. This includes a 301 or 307 without a Location header, which
      // fetch() cannot follow.
      if (res.status !== 200) {
        failOnce({
          status: res.status,
          headers: headersToObject(res.headers),
          message: res.statusText,
        });
        // This path never reads the body. The abort in destroyRequest() releases the body and
        // its connection. The Fetch standard specifies this: the abort algorithm from a `fetch()`
        // call also errors the response body stream, not only the request.
        destroyRequest();
        return;
      }

      if (!res.body) {
        failOnce({ message: 'stream response has no body' });
        return;
      }

      data = '';
      eventName = '';
      eventId = undefined;
      // A connection can drop between a carriage return and its line feed, which leaves the
      // flag set. A stale flag only skips one inert leading empty line, but the reset keeps
      // all parser state scoped to one connection.
      discardTrailingNewline = false;

      readyState = OPEN;
      resetReadTimeout(failOnce);
      emit(makeEvent('open', { headers: headersToObject(res.headers) }));

      // text/event-stream parser adapted from webkit's
      // Source/WebCore/page/EventSource.cpp
      let isFirst = true;
      let buf: Uint8Array | undefined;
      let startingPos = 0;
      let sizeUsed = 0;

      // The buffering mirrors the `res.on('data', ...)` handler in the original
      // `launchdarkly-eventsource` package, with `Uint8Array` operations in place of the
      // `Buffer` operations. The line scan does not mirror it: the original walks every
      // byte in a JS loop and restarts at index 0 for each line, which makes one large
      // chunk cost O(lines^2). A fetch transport hands over large coalesced chunks, so
      // this parser scans with `indexOf` instead and resumes where the last scan ended.
      // The dispatched events are identical; only the scan mechanics differ.
      const onData = (chunk: Uint8Array): void => {
        if (!buf) {
          buf = chunk;
          if (isFirst && hasBom(buf)) {
            buf = buf.subarray(bom.length);
            sizeUsed -= bom.length;
          }
        } else {
          // allocate new buffer
          const [resize, newCapacity] = CalculateCapacity(
            buf.length,
            chunk.length + sizeUsed,
            MAX_OVER_ALLOCATION,
          );
          if (resize) {
            const newBuffer = new Uint8Array(newCapacity);
            newBuffer.set(buf.subarray(0, sizeUsed), 0);
            buf = newBuffer;
          }

          buf.set(chunk, sizeUsed);
        }

        sizeUsed += chunk.length;
        isFirst = false;
        let pos = 0;
        const length = sizeUsed;

        while (pos < length) {
          if (discardTrailingNewline) {
            if (buf[pos] === lineFeed) {
              pos += 1;
            }
            discardTrailingNewline = false;
            if (pos >= length) {
              startingPos = 0;
              break;
            }
          }

          // A line ends at the first carriage return or line feed. Line feed is the
          // common terminator, so search it first. Then search the carriage return only
          // inside the span the line feed search found. This bounds every search to one
          // line and keeps the whole scan linear in the buffer size. `startingPos` marks
          // how far a previous call scanned a still-unterminated line, so no byte is
          // searched twice across calls.
          const scanFrom = startingPos > pos ? startingPos : pos;
          const region = buf.subarray(scanFrom, length);
          const lfRelative = region.indexOf(lineFeed);
          let terminatorPos;
          if (lfRelative < 0) {
            // No line feed in the buffered data. A lone carriage return is also a valid
            // terminator, so search the same span for one before treating the bytes as a
            // partial line.
            const crRelative = region.indexOf(carriageReturn);
            if (crRelative < 0) {
              startingPos = length - pos;
              break;
            }
            terminatorPos = scanFrom + crRelative;
            discardTrailingNewline = true;
          } else {
            const crRelative = region.subarray(0, lfRelative).indexOf(carriageReturn);
            if (crRelative >= 0) {
              terminatorPos = scanFrom + crRelative;
              discardTrailingNewline = true;
            } else {
              terminatorPos = scanFrom + lfRelative;
            }
          }
          startingPos = 0;

          const lineLength = terminatorPos - pos;
          // The field name ends at the first colon in the line. The search covers the
          // complete line, so a line split across chunks needs no carried-over colon
          // position.
          const fieldLength = buf.subarray(pos, terminatorPos).indexOf(colon);

          parseEventStreamLine(buf, pos, fieldLength, lineLength);

          pos = terminatorPos + 1;
        }

        if (pos === length) {
          buf = undefined;
          sizeUsed = 0;
        } else if (pos > 0) {
          buf = buf.subarray(pos);
          sizeUsed -= pos;
        }
      };

      const reader = res.body.getReader();
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
              onData(value);
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
    const delay = retryDelayStrategy.nextRetryDelay(new Date().getTime());

    emit(makeEvent('retrying', { delayMillis: delay }));

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
    const shouldRetry = (config.errorFilter || defaultErrorFilter)(
      errorEvent as unknown as ErrorEvent,
    );
    if (shouldRetry) {
      readyState = CONNECTING;
      emit(errorEvent);
      scheduleReconnect();
    } else {
      emit(errorEvent);
      readyState = CLOSED;
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
