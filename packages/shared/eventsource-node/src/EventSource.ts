/* This file is a line-by-line port of `eventsource.js` from the `js-eventsource` package. The port
 * keeps the declaration order, the closure structure, and the names of that file. You can read the
 * two files side by side. Comments that the original contains stay verbatim. The lint suppressions
 * that follow make the port possible:
 * - `no-use-before-define`: the original uses function hoisting for its mutually recursive closures.
 * - `no-this-alias`: the original writes `var self = this`, because its inner closures are plain
 *   functions.
 * - `no-param-reassign`: the original assigns a new value to the `url` parameter on redirect.
 * - `no-underscore-dangle`: the original names internal members `_emit`, `_close`, and `_listener`.
 */
/* oxlint-disable no-use-before-define */
/* oxlint-disable no-param-reassign */
/* oxlint-disable no-underscore-dangle */
/* oxlint-disable typescript/no-this-alias */

import { EventEmitter } from 'events';
import * as http from 'http';
import * as https from 'https';
import { parse, URL } from 'url';
import * as util from 'util';

import type { EventSource as PlatformEventSource } from '@launchdarkly/js-sdk-common';

import CalculateCapacity from './capacity';
import * as retryDelay from './retryDelay';
import {
  ClosedEvent,
  ErrorEvent,
  EventSourceListener,
  MessageEvent as MessageEventPayload,
  NodeEventSourceInitDict,
  OpenEvent,
  RetryingEvent,
  SupportedOptionName,
} from './types';

const httpsOptions = [
  'pfx',
  'key',
  'passphrase',
  'cert',
  'ca',
  'ciphers',
  'rejectUnauthorized',
  'secureProtocol',
  'servername',
  'checkServerIdentity',
];

const bom = [239, 187, 191];
const colon = 58;
const space = 32;
const lineFeed = 10;
const carriageReturn = 13;

const MAX_OVER_ALLOCATION = 1024 * 1024; // 1 MiB

function hasBom(buf: Buffer): boolean {
  return bom.every((charCode, index) => buf[index] === charCode);
}

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

/**
 * The public instance shape of a Node `EventSource`.
 *
 * Extends the platform `EventSource` interface from `@launchdarkly/js-sdk-common`, so the
 * compiler enforces the platform contract directly. The `on*` members are redeclared below with
 * this package's more specific event payload types; each stays assignable to its platform
 * counterpart.
 *
 * `_close` is an internal implementation detail (see `EventSourceImpl` below). It is not part of
 * the public contract. This interface declares it only because the `close()` prototype method must
 * call it through a typed member.
 */
interface EventSourceInstance extends EventEmitter, PlatformEventSource {
  readonly CONNECTING: 0;
  readonly OPEN: 1;
  readonly CLOSED: 2;
  readonly readyState: number;
  readonly url: string;
  reconnectInterval: number;
  onopen: ((e: OpenEvent) => void) | undefined;
  onend: ((e?: ErrorEvent) => void) | undefined;
  onerror: ((e?: ErrorEvent) => void) | undefined;
  onmessage: ((e: MessageEventPayload) => void) | undefined;
  onretrying: ((e: RetryingEvent) => void) | undefined;
  onclosed: ((e: ClosedEvent) => void) | undefined;
  /**
   * This implementation never invokes `onclose`. It emits a `closed` event instead. The member
   * exists so that code written against the platform EventSource interface compiles.
   */
  onclose: (() => void) | undefined;
  addEventListener(type: string, listener: EventSourceListener): void;
  removeEventListener(type: string, listener: EventSourceListener): void;
  dispatchEvent(event: { type?: string; detail?: any }): boolean;
  close(): void;
  /** @internal */
  _close(): void;
}

export interface EventSourceConstructor {
  new (url: string, eventSourceInitDict?: Partial<NodeEventSourceInitDict>): EventSourceInstance;
  readonly CONNECTING: 0;
  readonly OPEN: 1;
  readonly CLOSED: 2;
  readonly supportedOptions: Readonly<Record<string, true>>;
  readonly prototype: EventSourceInstance;
}

/**
 * Creates a new EventSource object
 *
 * This is a constructor function, not a class. The instance state (`readyState`, `config`, `req`,
 * `lastEventId`, ...) and the private functions (`connect`, `failed`, `scheduleReconnect`, ...)
 * are closures, as in the original. This also follows the monorepo convention: prefer closures and
 * factory functions over classes for public code. The constructor inherits from Node's
 * `EventEmitter` through `util.inherits`, as in the original. As a result, `.on`, `.once`,
 * `.listenerCount`, and the other emitter methods come from `EventEmitter`. Only `retry-delay.js`
 * and `capacity.js` live in their own modules, because the original also kept them separate.
 *
 * @param url the URL to which to connect
 * @param eventSourceInitDict extra init params. See README for details.
 */
function EventSourceImpl(
  this: EventSourceInstance,
  url: string,
  eventSourceInitDict?: Partial<NodeEventSourceInitDict>,
): void {
  let readyState: number = EventSource.CONNECTING;
  const config = (eventSourceInitDict ?? {}) as NodeEventSourceInitDict;

  Object.defineProperty(this, 'readyState', {
    get() {
      return readyState;
    },
  });

  Object.defineProperty(this, 'url', {
    get() {
      return url;
    },
  });

  const self = this;
  self.reconnectInterval = 1000;

  let req: http.ClientRequest | undefined;
  let lastEventId = '';
  if (config.headers && config.headers['Last-Event-ID']) {
    lastEventId = config.headers['Last-Event-ID'] as string;
  }

  let discardTrailingNewline = false;
  let data = '';
  let eventName: string | undefined;
  let eventId: string | undefined;

  let reconnectUrl: string | null = null;
  // The original calls this function with `new`. JavaScript ignores `new` on a function that
  // returns an object. TypeScript does not permit `new` on a plain function, so this call is
  // direct.
  const retryDelayStrategy = retryDelay.RetryDelayStrategy(
    config.initialRetryDelayMillis !== null && config.initialRetryDelayMillis !== undefined
      ? config.initialRetryDelayMillis
      : 1000,
    config.retryResetIntervalMillis,
    config.maxBackoffMillis ? retryDelay.defaultBackoff(config.maxBackoffMillis) : null,
    config.jitterRatio ? retryDelay.defaultJitter(config.jitterRatio) : null,
  );

  const streamOriginUrl = new URL(url).origin;

  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  function makeRequestUrlAndOptions(): { url: string | null; options: any } {
    // Returns { url, options }; url is null/undefined if the URL properties are in options
    let actualUrl: string | null = url;
    const options: any = { headers: {} };
    if (!config.skipDefaultHeaders) {
      options.headers['Cache-Control'] = 'no-cache';
      options.headers.Accept = 'text/event-stream';
    }
    if (lastEventId) options.headers['Last-Event-ID'] = lastEventId;
    if (config.headers) {
      // The original iterates with `for (var key in config.headers)` and a `hasOwnProperty`
      // guard. Object.keys() gives the same enumeration without the prototype-chain hazard.
      Object.keys(config.headers).forEach((key) => {
        options.headers[key] = config.headers[key];
      });
    }

    // The original forces `options.rejectUnauthorized` to false here unless a legacy top-level
    // `rejectUnauthorized` option is set, which disables certificate validation by default. The
    // port removes that: validation follows Node's own default, and `https.rejectUnauthorized`
    // is the only way to change it.

    // If specify http proxy, make the request to sent to the proxy server,
    // and include the original url in path and Host headers
    if (config.proxy) {
      actualUrl = null;
      const parsedUrl = parse(url);
      const proxy = parse(config.proxy);
      options.protocol = proxy.protocol === 'https:' ? 'https:' : 'http:';
      options.path = url;
      options.headers.Host = parsedUrl.host;
      options.hostname = proxy.hostname;
      options.host = proxy.host;
      options.port = proxy.port;
      // The original reads `proxy.username`/`proxy.password` here to build `options.auth`.
      // `url.parse` puts credentials in `auth` and never sets those two fields, so that branch
      // never runs, and the port omits it. Support for proxy credentials would be a behavior
      // change, which is out of scope for the port.
    }

    // When running in Node, proxies can also be specified as an agent
    if (config.agent) {
      options.agent = config.agent;
    }

    // If https options are specified, merge them into the request options
    if (config.https) {
      Object.keys(config.https).forEach((optName) => {
        if (httpsOptions.indexOf(optName) === -1) {
          return; // The original uses `continue` here.
        }

        const option = (config.https as unknown as Record<string, unknown>)[optName];
        if (option !== undefined) {
          (options as unknown as Record<string, unknown>)[optName] = option;
        }
      });
    }

    if (config.method) {
      options.method = config.method;
    }

    return { url: actualUrl, options };
  }

  function defaultErrorFilter(error: ErrorEvent): boolean {
    if (error.status) {
      const s = error.status;
      return s === 500 || s === 502 || s === 503 || s === 504;
    }
    return true; // always return I/O errors
  }

  function failed(error?: Partial<ErrorEvent>): void {
    if (readyState === EventSource.CLOSED) {
      return;
    }
    const errorEvent = error
      ? Event('error', error)
      : Event('end', { message: 'the request completed unexpectedly' });
    const shouldRetry = (config.errorFilter || defaultErrorFilter)(
      errorEvent as unknown as ErrorEvent,
    );
    if (shouldRetry) {
      readyState = EventSource.CONNECTING;
      _emit(errorEvent);
      scheduleReconnect();
    } else {
      _emit(errorEvent);
      readyState = EventSource.CLOSED;
      _emit(Event('closed'));
    }
  }

  function scheduleReconnect(): void {
    if (readyState !== EventSource.CONNECTING) return;
    const delay = retryDelayStrategy.nextRetryDelay(new Date().getTime());

    // The url may have been changed by a temporary redirect. If that's the case, revert it now.
    if (reconnectUrl) {
      url = reconnectUrl;
      reconnectUrl = null;
    }

    const event = Event('retrying') as { type: string; delayMillis?: number };
    event.delayMillis = delay;
    _emit(event);

    clearTimeout(reconnectTimer);

    reconnectTimer = setTimeout(() => {
      if (readyState !== EventSource.CONNECTING) return;
      connect();
    }, delay);
  }

  function destroyRequest(): void {
    // The original also aborts an `xhr` property that only exists under browser bundling; this
    // package is Node-only, so the port omits it.
    req?.destroy();
  }

  function connect(): void {
    const urlAndOptions = makeRequestUrlAndOptions();
    const isSecure =
      urlAndOptions.options.protocol === 'https:' ||
      (urlAndOptions.url && urlAndOptions.url.startsWith('https:'));

    // Each request should be able to fail at most once.
    const failOnce = once(failed);

    const callback = function callback(res: http.IncomingMessage): void {
      // Handle HTTP redirects
      if (res.statusCode === 301 || res.statusCode === 307) {
        if (!res.headers.location) {
          // Server sent redirect response without Location header.
          failOnce({
            status: res.statusCode,
            headers: res.headers as Record<string, string>,
            message: res.statusMessage,
          });
          return;
        }
        if (res.statusCode === 307) reconnectUrl = url;
        url = res.headers.location;
        process.nextTick(connect); // don't go through the scheduleReconnect logic since this isn't an error
        return;
      }

      // Handle HTTP errors
      if (res.statusCode !== 200) {
        failOnce({
          status: res.statusCode,
          headers: res.headers as Record<string, string>,
          message: res.statusMessage,
        });
        return;
      }

      data = '';
      eventName = '';
      eventId = undefined;

      readyState = EventSource.OPEN;
      res.on('close', () => {
        res.removeAllListeners('close');
        res.removeAllListeners('end');
        failOnce();
      });

      res.on('end', () => {
        res.removeAllListeners('close');
        res.removeAllListeners('end');
        failOnce();
      });
      _emit(Event('open', { headers: res.headers }));

      // text/event-stream parser adapted from webkit's
      // Source/WebCore/page/EventSource.cpp
      let isFirst = true;
      let buf: Buffer | undefined;
      let startingPos = 0;
      let startingFieldLength = -1;
      let sizeUsed = 0;

      res.on('data', (chunk: Buffer) => {
        if (!buf) {
          buf = chunk;
          if (isFirst && hasBom(buf)) {
            buf = buf.slice(bom.length);
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
            const newBuffer = Buffer.alloc(newCapacity);
            buf.copy(newBuffer, 0, 0, sizeUsed);
            buf = newBuffer;
          }

          chunk.copy(buf, sizeUsed);
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
          }

          let lineLength = -1;
          let fieldLength = startingFieldLength;
          let c;

          for (let i = startingPos; lineLength < 0 && i < length; i += 1) {
            c = buf[i];
            if (c === colon) {
              if (fieldLength < 0) {
                fieldLength = i - pos;
              }
            } else if (c === carriageReturn) {
              discardTrailingNewline = true;
              lineLength = i - pos;
            } else if (c === lineFeed) {
              lineLength = i - pos;
            }
          }

          if (lineLength < 0) {
            startingPos = length - pos;
            startingFieldLength = fieldLength;
            break;
          } else {
            startingPos = 0;
            startingFieldLength = -1;
          }

          parseEventStreamLine(buf, pos, fieldLength, lineLength);

          pos += lineLength + 1;
        }

        if (pos === length) {
          buf = undefined;
          sizeUsed = 0;
        } else if (pos > 0) {
          buf = buf.slice(pos);
          sizeUsed -= pos;
        }
      });
    };

    const api = (isSecure ? https : http) as typeof http;
    req = urlAndOptions.url
      ? api.request(urlAndOptions.url, urlAndOptions.options, callback)
      : api.request(urlAndOptions.options, callback);

    if (config.readTimeoutMillis) {
      req.setTimeout(config.readTimeoutMillis);
    }

    if (config.body) {
      req.write(config.body);
    }

    req.on('error', (err) => {
      failOnce({ message: err.message });
    });

    req.on('timeout', () => {
      failOnce({
        message: `Read timeout, received no data in ${config.readTimeoutMillis}ms, assuming connection is dead`,
      });
      // Timeout doesn't mean that the request is cancelled, just that it has elapsed the timeout.
      destroyRequest();
    });

    if (req.setNoDelay) req.setNoDelay(true);
    req.end();
  }

  connect();

  function _emit(event?: { type: string }): void {
    if (event) {
      self.emit(event.type, event);
    }
  }

  this._close = function _close(): void {
    clearTimeout(reconnectTimer);

    if (readyState === EventSource.CLOSED) return;
    readyState = EventSource.CLOSED;

    destroyRequest();

    _emit(Event('closed'));
  };

  function receivedEvent(event: MessageEventPayload): void {
    retryDelayStrategy.setGoodSince(new Date().getTime());
    _emit(event);
  }

  function parseEventStreamLine(
    buf: Buffer,
    pos: number,
    fieldLength: number,
    lineLength: number,
  ): void {
    if (lineLength === 0) {
      if (data.length > 0) {
        const type = eventName || 'message';
        if (eventId !== undefined) {
          lastEventId = eventId;
        }
        const event = MessageEvent(type, {
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
      const field = buf.slice(pos, pos + (noValue ? lineLength : fieldLength)).toString();

      if (noValue) {
        step = lineLength;
      } else if (buf[pos + fieldLength + 1] !== space) {
        step = fieldLength + 1;
      } else {
        step = fieldLength + 2;
      }
      pos += step;

      const valueLength = lineLength - step;
      const value = buf.slice(pos, pos + valueLength).toString();

      if (field === 'data') {
        data += `${value}\n`;
      } else if (field === 'event') {
        eventName = value;
      } else if (field === 'id') {
        // The original writes this character as a NUL escape sequence in a string literal.
        // String.fromCharCode(0) is the same character. The escape form is avoided here because
        // some tools corrupt it.
        if (!value.includes(String.fromCharCode(0))) {
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
  }
}

// This export sits where the original writes `module.exports = { EventSource: EventSource }`.
// It is a named export, not `export default`: a default export of a plain value carries no linked
// instance type, unlike a default export of a `class`. The type alias and the const share one name
// on purpose. A same-named `interface` is not possible here: the declaration bundler in tsup
// (rollup-plugin-dts) fails on an interface merged with a const of the same name, but it accepts
// the alias form. The single `export { EventSource }` carries the value and the type. As a result,
// `import { EventSource }` works as a value (`new EventSource(...)`) and as the instance type
// (`es: EventSource`). The const keeps the name `EventSource` so that the `EventSource.CONNECTING`,
// `OPEN`, and `CLOSED` references above read as in the original.
type EventSource = EventSourceInstance;
const EventSource = EventSourceImpl as unknown as EventSourceConstructor;
export { EventSource };

util.inherits(EventSourceImpl, EventEmitter);
EventSourceImpl.prototype.constructor = EventSourceImpl; // make stacktraces readable

['open', 'end', 'error', 'message', 'retrying', 'closed'].forEach((method) => {
  Object.defineProperty(EventSourceImpl.prototype, `on${method}`, {
    /**
     * Returns the current listener
     *
     * @return the set function or undefined
     */
    get(): EventSourceListener | undefined {
      const listener = this.listeners(method)[0] as
        | (EventSourceListener & { _listener?: EventSourceListener })
        | undefined;
      return listener ? (listener._listener ? listener._listener : listener) : undefined;
    },

    /**
     * Start listening for events
     *
     * @param listener the listener
     */
    set(listener: EventSourceListener | undefined): void {
      this.removeAllListeners(method);
      this.addEventListener(method, listener);
    },
  });
});

/**
 * Ready states
 */
Object.defineProperty(EventSourceImpl, 'CONNECTING', { enumerable: true, value: 0 });
Object.defineProperty(EventSourceImpl, 'OPEN', { enumerable: true, value: 1 });
Object.defineProperty(EventSourceImpl, 'CLOSED', { enumerable: true, value: 2 });

EventSourceImpl.prototype.CONNECTING = 0;
EventSourceImpl.prototype.OPEN = 1;
EventSourceImpl.prototype.CLOSED = 2;

/**
 * Adds the EventSource.supportedOptions property that allows application code to know which
 * custom options are supported by this polyfill.
 */
const supportedOptions: SupportedOptionName[] = [
  'errorFilter',
  'headers',
  'https',
  'initialRetryDelayMillis',
  'jitterRatio',
  'maxBackoffMillis',
  'method',
  'proxy',
  'retryResetIntervalMillis',
  'skipDefaultHeaders',
];
const supportedOptionsObject = {};
supportedOptions.forEach((name) => {
  // Using custom properties for this allows us to make them read-only.
  Object.defineProperty(supportedOptionsObject, name, { enumerable: true, value: true });
});
Object.defineProperty(EventSourceImpl, 'supportedOptions', {
  enumerable: true,
  value: supportedOptionsObject,
});

/**
 * Closes the connection, if one is made, and sets the readyState attribute to 2 (closed)
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/EventSource/close
 */
EventSourceImpl.prototype.close = function close(): void {
  this._close();
};

/**
 * Emulates the W3C Browser based WebSocket interface using addEventListener.
 *
 * @param type A string representing the event type to listen out for
 * @param listener callback
 * @see https://developer.mozilla.org/en/DOM/element.addEventListener
 * @see http://dev.w3.org/html5/websockets/#the-websocket-interface
 */
EventSourceImpl.prototype.addEventListener = function addEventListener(
  type: string,
  listener: EventSourceListener,
): void {
  if (typeof listener === 'function') {
    // store a reference so we can return the original function again
    (listener as EventSourceListener & { _listener?: EventSourceListener })._listener = listener;
    this.on(type, listener);
  }
};

/**
 * Emulates the W3C Browser based WebSocket interface using dispatchEvent.
 *
 * @param event An event to be dispatched
 * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/dispatchEvent
 */
EventSourceImpl.prototype.dispatchEvent = function dispatchEvent(event: {
  type?: string;
  detail?: any;
}): boolean {
  if (!event.type) {
    throw new Error('UNSPECIFIED_EVENT_TYPE_ERR');
  }
  // if event is instance of an CustomEvent (or has 'details' property),
  // send the detail object as the payload for the event
  return this.emit(event.type, event.detail);
};

/**
 * Emulates the W3C Browser based WebSocket interface using removeEventListener.
 *
 * @param type A string representing the event type to remove
 * @param listener callback
 * @see https://developer.mozilla.org/en/DOM/element.removeEventListener
 * @see http://dev.w3.org/html5/websockets/#the-websocket-interface
 */
EventSourceImpl.prototype.removeEventListener = function removeEventListener(
  type: string,
  listener: EventSourceListener,
): void {
  if (typeof listener === 'function') {
    (listener as EventSourceListener & { _listener?: EventSourceListener })._listener = undefined;
    this.removeListener(type, listener);
  }
};

/**
 * W3C Event
 *
 * The original declares this as a constructor function and invokes it with `new`. TypeScript does
 * not permit `new` on a plain function. So this port writes it as a factory function that returns
 * the same object shape.
 *
 * @see http://www.w3.org/TR/DOM-Level-3-Events/#interface-Event
 */
function Event(type: string, optionalProperties?: Record<string, unknown>): { type: string } {
  const event: Record<string, unknown> = {};
  Object.defineProperty(event, 'type', { writable: false, value: type, enumerable: true });
  if (optionalProperties) {
    Object.keys(optionalProperties).forEach((f) => {
      Object.defineProperty(event, f, {
        writable: false,
        value: optionalProperties[f],
        enumerable: true,
      });
    });
  }
  return event as { type: string };
}

/**
 * W3C MessageEvent
 *
 * This is a factory function, not a constructor, for the same reason as `Event` above.
 *
 * @see http://www.w3.org/TR/webmessaging/#event-definitions
 */
function MessageEvent(type: string, eventInitDict: Record<string, unknown>): MessageEventPayload {
  const event: Record<string, unknown> = {};
  Object.defineProperty(event, 'type', { writable: false, value: type, enumerable: true });
  Object.keys(eventInitDict).forEach((f) => {
    Object.defineProperty(event, f, {
      writable: false,
      value: eventInitDict[f],
      enumerable: true,
    });
  });
  return event as unknown as MessageEventPayload;
}

export type {
  OpenEvent,
  ErrorEvent,
  RetryingEvent,
  ClosedEvent,
  MessageEventPayload as MessageEvent,
};
