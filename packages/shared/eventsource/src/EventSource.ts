import { EventEmitter } from 'events';
import * as http from 'http';
import * as https from 'https';
import { parse as parseUrl, Url } from 'url';

import calculateCapacity from './capacity';
import { ESEvent, ESMessageEvent } from './events';
import { defaultBackoff, defaultJitter, RetryDelayStrategy } from './retryDelay';
import {
  ClosedEvent,
  ErrorEvent,
  EventSourceInitDict,
  EventSourceListener,
  MessageEvent,
  OpenEvent,
  RetryingEvent,
  SupportedOptionName,
} from './types';

const httpsOptionNames: string[] = [
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
const nul = String.fromCharCode(0);

const MAX_OVER_ALLOCATION = 1024 * 1024; // 1 MiB

/** Request options, plus the non-standard `withCredentials` flag that is passed straight through. */
type RequestOptions = https.RequestOptions & { withCredentials?: boolean };

/** A `ClientRequest`, plus the `xhr` property present only under browser bundling. */
type RequestWithXhr = http.ClientRequest & { xhr?: { abort?: () => void } };

/** Raw properties attached to an `error`/`end` event. */
type RawErrorPayload = {
  status?: number;
  headers?: Record<string, string>;
  message?: string;
};

/** A listener tagged with the caller's original function, so the on* getters can return it. */
type TaggedListener = EventSourceListener & { _listener?: EventSourceListener };

/** `url.parse` never populates these, but the ported proxy code reads them. */
type LegacyParsedProxyUrl = Url & { username?: string; password?: string };

function hasBom(buf: Buffer): boolean {
  return bom.every((charCode, index) => buf[index] === charCode);
}

/** Wrap a callback to ensure it can only be called once. */
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
  return true; // always retry I/O errors
}

const supportedOptionNames: SupportedOptionName[] = [
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
  'withCredentials',
];

const supportedOptionsObject: Readonly<Record<string, true>> = (() => {
  const obj: Record<string, true> = {};
  supportedOptionNames.forEach((name) => {
    // Using custom properties for this allows us to make them read-only.
    Object.defineProperty(obj, name, { enumerable: true, value: true });
  });
  return obj;
})();

/**
 * W3C-compliant EventSource (server-sent events) client for Node.
 */
export default class EventSource extends EventEmitter {
  /**
   * Ready states.
   */
  static readonly CONNECTING = 0;

  static readonly OPEN = 1;

  static readonly CLOSED = 2;

  /**
   * Allows application code to know which custom options are supported by this implementation.
   */
  // Name is part of the public API inherited from the package this was ported from.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  static readonly supportedOptions = supportedOptionsObject;

  /* eslint-disable @typescript-eslint/naming-convention -- W3C readyState constant names. */
  readonly CONNECTING = 0;

  readonly OPEN = 1;

  readonly CLOSED = 2;
  /* eslint-enable @typescript-eslint/naming-convention */

  /**
   * Updated when the server sends a `retry:` directive. Present for backward compatibility; the
   * value actually used for reconnection is managed by the retry delay strategy.
   */
  reconnectInterval: number = 1000;

  /**
   * Declared, but never invoked by this implementation, which emits `closed` instead. It exists so
   * that callers written against the LaunchDarkly platform EventSource interface type-check.
   */
  declare onclose: (() => void) | undefined;

  private _readyState: number = EventSource.CONNECTING;

  private _url: string;

  // Assigned via Object.defineProperty in the constructor, not a plain field assignment, so
  // TypeScript's control-flow analysis can't see the assignment; asserted definite instead.
  private _config!: EventSourceInitDict;

  private _req?: http.ClientRequest;

  private _lastEventId: string = '';

  private _discardTrailingNewline: boolean = false;

  private _data: string = '';

  private _eventName?: string;

  private _eventId?: string;

  private _reconnectUrl: string | null = null;

  private _retryDelayStrategy: RetryDelayStrategy;

  private _streamOriginUrl: string;

  private _reconnectTimer?: ReturnType<typeof setTimeout>;

  /**
   * Creates a new EventSource object.
   *
   * @param url The URL to which to connect.
   * @param eventSourceInitDict Extra init params. See README for details.
   */
  constructor(url: string, eventSourceInitDict?: EventSourceInitDict) {
    super();
    this._url = url;
    const config = eventSourceInitDict ?? {};
    // Config carries request headers, which may include SDK-key-bearing authorization values.
    // Assigning it as a plain field would make it enumerable, so it would show up in
    // util.inspect/console.log/JSON.stringify output (crash reporter breadcrumbs, etc).
    Object.defineProperty(this, '_config', {
      value: config,
      writable: true,
      enumerable: false,
      configurable: true,
    });

    if (config.headers && config.headers['Last-Event-ID']) {
      this._lastEventId = config.headers['Last-Event-ID'] as string;
    }

    this._retryDelayStrategy = new RetryDelayStrategy(
      config.initialRetryDelayMillis ?? 1000,
      config.retryResetIntervalMillis,
      config.maxBackoffMillis ? defaultBackoff(config.maxBackoffMillis) : null,
      config.jitterRatio ? defaultJitter(config.jitterRatio) : null,
    );

    this._streamOriginUrl = new URL(url).origin;

    this._connect();
  }

  get readyState(): number {
    return this._readyState;
  }

  get url(): string {
    return this._url;
  }

  /**
   * Returns the current listener.
   */
  get onopen(): ((e: OpenEvent) => void) | undefined {
    return this._getHandler('open');
  }

  /**
   * Starts listening for events.
   */
  set onopen(listener: ((e: OpenEvent) => void) | undefined) {
    this._setHandler('open', listener as EventSourceListener | undefined);
  }

  /**
   * Returns the current listener.
   */
  get onmessage(): ((e: MessageEvent) => void) | undefined {
    return this._getHandler('message');
  }

  /**
   * Starts listening for events.
   */
  set onmessage(listener: ((e: MessageEvent) => void) | undefined) {
    this._setHandler('message', listener as EventSourceListener | undefined);
  }

  /**
   * Returns the current listener.
   */
  get onerror(): ((e?: ErrorEvent) => void) | undefined {
    return this._getHandler('error');
  }

  /**
   * Starts listening for events.
   */
  set onerror(listener: ((e?: ErrorEvent) => void) | undefined) {
    this._setHandler('error', listener as EventSourceListener | undefined);
  }

  /**
   * Returns the current listener.
   */
  get onend(): ((e?: ErrorEvent) => void) | undefined {
    return this._getHandler('end');
  }

  /**
   * Starts listening for events.
   */
  set onend(listener: ((e?: ErrorEvent) => void) | undefined) {
    this._setHandler('end', listener as EventSourceListener | undefined);
  }

  /**
   * Returns the current listener.
   */
  get onretrying(): ((e: RetryingEvent) => void) | undefined {
    return this._getHandler('retrying');
  }

  /**
   * Starts listening for events.
   */
  set onretrying(listener: ((e: RetryingEvent) => void) | undefined) {
    this._setHandler('retrying', listener as EventSourceListener | undefined);
  }

  /**
   * Returns the current listener.
   */
  get onclosed(): ((e: ClosedEvent) => void) | undefined {
    return this._getHandler('closed');
  }

  /**
   * Starts listening for events.
   */
  set onclosed(listener: ((e: ClosedEvent) => void) | undefined) {
    this._setHandler('closed', listener as EventSourceListener | undefined);
  }

  /**
   * Emulates the W3C browser-based interface using addEventListener.
   *
   * @param type A string representing the event type to listen out for.
   * @param listener The callback.
   * @see https://developer.mozilla.org/en/DOM/element.addEventListener
   * @see http://dev.w3.org/html5/websockets/#the-websocket-interface
   */
  addEventListener(type: string, listener: EventSourceListener): void {
    if (typeof listener === 'function') {
      // Store a reference so we can return the original function again.
      // eslint-disable-next-line no-underscore-dangle
      (listener as TaggedListener)._listener = listener;
      this.on(type, listener);
    }
  }

  /**
   * Emulates the W3C browser-based interface using removeEventListener.
   *
   * @param type A string representing the event type to remove.
   * @param listener The callback.
   * @see https://developer.mozilla.org/en/DOM/element.removeEventListener
   * @see http://dev.w3.org/html5/websockets/#the-websocket-interface
   */
  removeEventListener(type: string, listener: EventSourceListener): void {
    if (typeof listener === 'function') {
      // eslint-disable-next-line no-underscore-dangle
      (listener as TaggedListener)._listener = undefined;
      this.removeListener(type, listener);
    }
  }

  /**
   * Emulates the W3C browser-based interface using dispatchEvent.
   *
   * @param event An event to be dispatched.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/dispatchEvent
   */
  dispatchEvent(event: { type?: string; detail?: any }): void {
    if (!event.type) {
      throw new Error('UNSPECIFIED_EVENT_TYPE_ERR');
    }
    // If event is an instance of CustomEvent (or has a 'detail' property), send the detail object
    // as the payload for the event.
    this.emit(event.type, event.detail);
  }

  /**
   * Closes the connection, if one is made, and sets the readyState attribute to 2 (closed).
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/EventSource/close
   */
  close(): void {
    this._close();
  }

  private _close(): void {
    clearTimeout(this._reconnectTimer);

    if (this._readyState === EventSource.CLOSED) return;
    this._readyState = EventSource.CLOSED;

    this._destroyRequest();

    this._emit(new ESEvent('closed'));
  }

  private _getHandler(type: string): any {
    const listener = this.listeners(type)[0] as TaggedListener | undefined;
    // eslint-disable-next-line no-underscore-dangle
    return listener ? listener._listener ?? listener : undefined;
  }

  private _setHandler(type: string, listener: EventSourceListener | undefined): void {
    this.removeAllListeners(type);
    this.addEventListener(type, listener as EventSourceListener);
  }

  private _emit(event: ESEvent | ESMessageEvent): void {
    if (event) {
      this.emit(event.type, event);
    }
  }

  private _destroyRequest(): void {
    const req = this._req as RequestWithXhr | undefined;
    req?.destroy?.();
    // The xhr property only exists when this code is bundled for a browser; it is absent in Node.
    req?.xhr?.abort?.();
  }

  private _failed(error?: RawErrorPayload): void {
    if (this._readyState === EventSource.CLOSED) {
      return;
    }
    const errorEvent = error
      ? new ESEvent('error', error)
      : new ESEvent('end', { message: 'the request completed unexpectedly' });
    const filter = this._config.errorFilter ?? defaultErrorFilter;
    const shouldRetry = filter(errorEvent as unknown as ErrorEvent);
    if (shouldRetry) {
      this._readyState = EventSource.CONNECTING;
      this._emit(errorEvent);
      this._scheduleReconnect();
    } else {
      this._emit(errorEvent);
      this._readyState = EventSource.CLOSED;
      this._emit(new ESEvent('closed'));
    }
  }

  private _scheduleReconnect(): void {
    if (this._readyState !== EventSource.CONNECTING) return;
    const delay = this._retryDelayStrategy.nextRetryDelay(new Date().getTime());

    // The url may have been changed by a temporary redirect. If that's the case, revert it now.
    if (this._reconnectUrl) {
      this._url = this._reconnectUrl;
      this._reconnectUrl = null;
    }

    this._emit(new ESEvent('retrying', { delayMillis: delay }));

    clearTimeout(this._reconnectTimer);

    this._reconnectTimer = setTimeout(() => {
      if (this._readyState !== EventSource.CONNECTING) return;
      this._connect();
    }, delay);
  }

  private _makeRequestUrlAndOptions(): { url: string | null; options: RequestOptions } {
    // Returns { url, options }; url is null if the URL properties are in options.
    let actualUrl: string | null = this._url;
    const headers: http.OutgoingHttpHeaders = {};
    const options: RequestOptions = { headers };
    const config = this._config;

    if (!config.skipDefaultHeaders) {
      headers['Cache-Control'] = 'no-cache';
      headers.Accept = 'text/event-stream';
    }
    if (this._lastEventId) headers['Last-Event-ID'] = this._lastEventId;
    if (config.headers) {
      const configHeaders = config.headers;
      Object.keys(configHeaders).forEach((key) => {
        headers[key] = configHeaders[key];
      });
    }

    // Legacy: this should be specified as `eventSourceInitDict.https.rejectUnauthorized`, but for
    // now exists as a backwards-compatibility layer.
    options.rejectUnauthorized = !!config.rejectUnauthorized;

    // If an http proxy is specified, make the request to the proxy server and include the original
    // url in the path and Host headers.
    if (config.proxy) {
      actualUrl = null;
      const parsedUrl = parseUrl(this._url);
      const proxy = parseUrl(config.proxy) as LegacyParsedProxyUrl;
      options.protocol = proxy.protocol === 'https:' ? 'https:' : 'http:';
      options.path = this._url;
      (headers as Record<string, unknown>).Host = parsedUrl.host;
      options.hostname = proxy.hostname;
      options.host = proxy.host;
      options.port = proxy.port;
      // `url.parse` exposes credentials as `auth`, never as `username`/`password`, so this branch
      // never runs. It is preserved verbatim from the JavaScript implementation this package was
      // ported from; making proxy credentials work would be a behavior change, out of scope here.
      if (proxy.username) {
        options.auth = `${proxy.username}:${proxy.password}`;
      }
    }

    // When running in Node, proxies can also be specified as an agent.
    if (config.agent) {
      options.agent = config.agent;
    }

    // If https options are specified, merge them into the request options.
    if (config.https) {
      const httpsConfig = config.https as unknown as Record<string, unknown>;
      Object.keys(httpsConfig).forEach((optName) => {
        if (!httpsOptionNames.includes(optName)) {
          return;
        }
        const option = httpsConfig[optName];
        if (option !== undefined) {
          (options as unknown as Record<string, unknown>)[optName] = option;
        }
      });
    }

    // Pass this on to the XHR.
    if (config.withCredentials !== undefined) {
      options.withCredentials = config.withCredentials;
    }

    if (config.method) {
      options.method = config.method;
    }

    return { url: actualUrl, options };
  }

  private _connect(): void {
    const urlAndOptions = this._makeRequestUrlAndOptions();
    const isSecure =
      urlAndOptions.options.protocol === 'https:' ||
      (!!urlAndOptions.url && urlAndOptions.url.startsWith('https:'));

    // Each request should be able to fail at most once.
    const failOnce = once((error?: RawErrorPayload) => this._failed(error));

    const callback = (res: http.IncomingMessage): void => {
      // Handle HTTP redirects.
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
        if (res.statusCode === 307) this._reconnectUrl = this._url;
        // NOTE: the redirect target origin is not validated and the original request headers are
        // re-sent to it. Preserved from the implementation this package was ported from; changing
        // it is tracked separately and is out of scope for this port.
        this._url = res.headers.location;
        // Don't go through the scheduleReconnect logic since this isn't an error.
        process.nextTick(() => this._connect());
        return;
      }

      // Handle HTTP errors.
      if (res.statusCode !== 200) {
        failOnce({
          status: res.statusCode,
          headers: res.headers as Record<string, string>,
          message: res.statusMessage,
        });
        return;
      }

      this._data = '';
      this._eventName = '';
      this._eventId = undefined;

      this._readyState = EventSource.OPEN;
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
      this._emit(new ESEvent('open', { headers: res.headers }));

      // text/event-stream parser adapted from webkit's Source/WebCore/page/EventSource.cpp
      let isFirst = true;
      let buf: Buffer | undefined;
      let startingPos = 0;
      let startingFieldLength = -1;
      let sizeUsed = 0;

      res.on('data', (chunk: Buffer) => {
        if (!buf) {
          buf = chunk;
          if (isFirst && hasBom(buf)) {
            buf = buf.subarray(bom.length);
            sizeUsed -= bom.length;
          }
        } else {
          // Allocate a new buffer if the existing one cannot hold the new chunk.
          const [resize, newCapacity] = calculateCapacity(
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
          if (this._discardTrailingNewline) {
            if (buf[pos] === lineFeed) {
              pos += 1;
            }
            this._discardTrailingNewline = false;
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
              this._discardTrailingNewline = true;
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

          this._parseEventStreamLine(buf, pos, fieldLength, lineLength);

          pos += lineLength + 1;
        }

        if (pos === length) {
          buf = undefined;
          sizeUsed = 0;
        } else if (pos > 0) {
          buf = buf.subarray(pos);
          sizeUsed -= pos;
        }
      });
    };

    const requestFn: typeof http.request = isSecure
      ? (https.request as typeof http.request)
      : http.request;
    const req = urlAndOptions.url
      ? requestFn(urlAndOptions.url, urlAndOptions.options, callback)
      : requestFn(urlAndOptions.options, callback);
    // Same reasoning as the _config definition above: the request carries the serialized
    // headers, so it must not be enumerable either.
    Object.defineProperty(this, '_req', {
      value: req,
      writable: true,
      enumerable: false,
      configurable: true,
    });

    if (this._config.readTimeoutMillis) {
      req.setTimeout(this._config.readTimeoutMillis);
    }

    if (this._config.body) {
      req.write(this._config.body);
    }

    req.on('error', (err: Error) => {
      failOnce({ message: err.message });
    });

    req.on('timeout', () => {
      failOnce({
        message: `Read timeout, received no data in ${this._config.readTimeoutMillis}ms, assuming connection is dead`,
      });
      // Timeout doesn't mean that the request is cancelled, just that it has elapsed the timeout.
      this._destroyRequest();
    });

    if (req.setNoDelay) req.setNoDelay(true);
    req.end();
  }

  private _receivedEvent(event: ESMessageEvent): void {
    // NOTE: this marks the stream as healthy on every received event rather than once per
    // connection. Preserved from the implementation this package was ported from.
    this._retryDelayStrategy.setGoodSince(new Date().getTime());
    this._emit(event);
  }

  private _parseEventStreamLine(
    buf: Buffer,
    pos: number,
    fieldLength: number,
    lineLength: number,
  ): void {
    if (lineLength === 0) {
      if (this._data.length > 0) {
        const type = this._eventName || 'message';
        if (this._eventId !== undefined) {
          this._lastEventId = this._eventId;
        }
        const event = new ESMessageEvent(type, {
          data: this._data.slice(0, -1), // remove trailing newline
          lastEventId: this._lastEventId,
          origin: this._streamOriginUrl,
        });
        this._data = '';
        this._eventId = undefined;
        this._receivedEvent(event);
      }
      this._eventName = undefined;
    } else {
      const noValue = fieldLength < 0;
      let step = 0;
      const field = buf.subarray(pos, pos + (noValue ? lineLength : fieldLength)).toString();

      if (noValue) {
        step = lineLength;
      } else if (buf[pos + fieldLength + 1] !== space) {
        step = fieldLength + 1;
      } else {
        step = fieldLength + 2;
      }
      const valueStart = pos + step;

      const valueLength = lineLength - step;
      const value = buf.subarray(valueStart, valueStart + valueLength).toString();

      if (field === 'data') {
        this._data += `${value}\n`;
      } else if (field === 'event') {
        this._eventName = value;
      } else if (field === 'id') {
        if (!value.includes(nul)) {
          this._eventId = value;
        }
      } else if (field === 'retry') {
        const retry = parseInt(value, 10);
        if (!Number.isNaN(retry)) {
          // NOTE: setBaseDelay also resets the backoff retry count. That matches browser
          // EventSource semantics and is intentional.
          this.reconnectInterval = retry;
          this._retryDelayStrategy.setBaseDelay(retry);
        }
      }
    }
  }
}
