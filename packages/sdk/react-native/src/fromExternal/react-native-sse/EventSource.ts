/**
 * Ripped from https://github.com/binaryminds/react-native-sse
 * These changes are made from the above repo at fork-time:
 * 1. converted to ts and fix ts related errors.
 * 2. added onopen, onclose, onerror, onretrying functions.
 * 3. modified dispatch to work with functions added in 2.
 * 4. replaced all for of loops with foreach
 */
import type { EventSourceEvent, EventSourceListener, EventSourceOptions, EventType } from './types';

const XMLReadyStateMap = ['UNSENT', 'OPENED', 'HEADERS_RECEIVED', 'LOADING', 'DONE'];

const defaultOptions: EventSourceOptions = {
  body: undefined,
  headers: {},
  method: 'GET',
  timeout: 0,
  withCredentials: false,
  retryAndHandleError: undefined,
  initialRetryDelayMillis: 1000,
  logger: undefined,
};

const maxRetryDelay = 30 * 1000; // Maximum retry delay 30 seconds.
const jitterRatio = 0.5; // Delay should be 50%-100% of calculated time.

export function backoff(base: number, retryCount: number) {
  const delay = base * Math.pow(2, retryCount);
  return Math.min(delay, maxRetryDelay);
}

export function jitter(computedDelayMillis: number) {
  return computedDelayMillis - Math.trunc(Math.random() * jitterRatio * computedDelayMillis);
}

export default class EventSource<E extends string = never> {
  ERROR = -1;
  CONNECTING = 0;
  OPEN = 1;
  CLOSED = 2;

  private _lastEventId: undefined | string;
  private _lastIndexProcessed = 0;
  private _eventType: undefined | EventType<E>;
  private _status = this.CONNECTING;
  private _eventHandlers: any = {
    open: [],
    message: [],
    error: [],
    close: [],
  };

  private _method: string;
  private _timeout: number;
  private _withCredentials: boolean;
  private _headers: Record<string, any>;
  private _body: any;
  private _url: string;
  private _xhr: XMLHttpRequest = new XMLHttpRequest();
  private _connectTimer: any;
  private _retryAndHandleError?: (err: any) => boolean;
  private _initialRetryDelayMillis: number = 1000;
  private _retryCount: number = 0;
  private _logger?: any;

  constructor(url: string, options?: EventSourceOptions) {
    const opts = {
      ...defaultOptions,
      ...options,
    };

    this._url = url;
    this._method = opts.method!;
    this._timeout = opts.timeout!;
    this._withCredentials = opts.withCredentials!;
    this._headers = opts.headers!;
    this._body = opts.body;
    this._retryAndHandleError = opts.retryAndHandleError;
    this._initialRetryDelayMillis = opts.initialRetryDelayMillis!;
    this._logger = opts.logger;

    this._tryConnect(true);
  }

  private _getNextRetryDelay() {
    const delay = jitter(backoff(this._initialRetryDelayMillis, this._retryCount));
    this._retryCount += 1;
    return delay;
  }

  private _tryConnect(initialConnection: boolean = false) {
    let delay = initialConnection ? 0 : this._getNextRetryDelay();
    if (initialConnection) {
      this._logger?.debug(`[EventSource] opening new connection.`);
    } else {
      this._logger?.debug(`[EventSource] Will open new connection in ${delay} ms.`);
      this.dispatch('retry', { type: 'retry', delayMillis: delay });
    }

    this._connectTimer = setTimeout(() => {
      if (!initialConnection) {
        this.close();
      }

      this._open();
    }, delay);
  }

  private _open() {
    try {
      this._lastIndexProcessed = 0;
      this._status = this.CONNECTING;
      this._xhr.open(this._method, this._url, true);

      if (this._withCredentials) {
        this._xhr.withCredentials = true;
      }

      this._xhr.setRequestHeader('Accept', 'text/event-stream');
      this._xhr.setRequestHeader('Cache-Control', 'no-cache');
      this._xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

      if (this._headers) {
        Object.entries(this._headers).forEach(([key, value]) => {
          this._xhr.setRequestHeader(key, value);
        });
      }

      if (typeof this._lastEventId !== 'undefined') {
        this._xhr.setRequestHeader('Last-Event-ID', this._lastEventId);
      }

      this._xhr.timeout = this._timeout;

      this._xhr.onreadystatechange = () => {
        if (this._status === this.CLOSED) {
          return;
        }

        this._logger?.debug(
          `[EventSource][onreadystatechange] ReadyState: ${
            XMLReadyStateMap[this._xhr.readyState] || 'Unknown'
          }(${this._xhr.readyState}), status: ${this._xhr.status}`,
        );

        if (
          this._xhr.readyState !== XMLHttpRequest.DONE &&
          this._xhr.readyState !== XMLHttpRequest.LOADING
        ) {
          return;
        }

        if (this._xhr.status >= 200 && this._xhr.status < 400) {
          if (this._status === this.CONNECTING) {
            this._retryCount = 0;
            this._status = this.OPEN;
            this.dispatch('open', { type: 'open' });
            this._logger?.debug('[EventSource][onreadystatechange][OPEN] Connection opened.');
          }

          // retry from server gets set here
          this._handleEvent(this._xhr.responseText || '');

          if (this._xhr.readyState === XMLHttpRequest.DONE) {
            this._logger?.debug('[EventSource][onreadystatechange][DONE] Operation done.');
            this._tryConnect();
          }
        } else {
          this._status = this.ERROR;

          this.dispatch('error', {
            type: 'error',
            message: this._xhr.responseText,
            xhrStatus: this._xhr.status,
            xhrState: this._xhr.readyState,
          });

          if (this._xhr.readyState === XMLHttpRequest.DONE) {
            this._logger?.debug('[EventSource][onreadystatechange][ERROR] Response status error.');

            if (!this._retryAndHandleError) {
              // by default just try and reconnect if there's an error.
              this._tryConnect();
            } else {
              // custom retry logic taking into account status codes.
              const shouldRetry = this._retryAndHandleError({
                status: this._xhr.status,
                message: this._xhr.responseText,
              });

              if (shouldRetry) {
                this._tryConnect();
              }
            }
          }
        }
      };

      this._xhr.onerror = () => {
        if (this._status === this.CLOSED) {
          return;
        }

        this._status = this.ERROR;
        this.dispatch('error', {
          type: 'error',
          message: this._xhr.responseText,
          xhrStatus: this._xhr.status,
          xhrState: this._xhr.readyState,
        });
      };

      if (this._body) {
        this._xhr.send(this._body);
      } else {
        this._xhr.send();
      }

      if (this._timeout > 0) {
        setTimeout(() => {
          if (this._xhr.readyState === XMLHttpRequest.LOADING) {
            this.dispatch('error', { type: 'timeout' });
            this.close();
          }
        }, this._timeout);
      }
    } catch (e: any) {
      this._status = this.ERROR;
      this.dispatch('error', {
        type: 'exception',
        message: e.message,
        error: e,
      });
    }
  }

  private _handleEvent(response: string) {
    const parts = response.slice(this._lastIndexProcessed).split('\n');

    const indexOfDoubleNewline = response.lastIndexOf('\n\n');
    if (indexOfDoubleNewline !== -1) {
      this._lastIndexProcessed = indexOfDoubleNewline + 2;
    }

    let data = [];
    let retry = 0;
    let line = '';

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < parts.length; i++) {
      line = parts[i].replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, '');
      if (line.indexOf('event') === 0) {
        this._eventType = line.replace(/event:?\s*/, '') as EventType<E>;
      } else if (line.indexOf('retry') === 0) {
        retry = parseInt(line.replace(/retry:?\s*/, ''), 10);
        if (!Number.isNaN(retry)) {
          // GOTCHA: Ignore the server retry recommendation. Use our own custom getNextRetryDelay logic.
          // this.pollingInterval = retry;
        }
      } else if (line.indexOf('data') === 0) {
        data.push(line.replace(/data:?\s*/, ''));
      } else if (line.indexOf('id:') === 0) {
        this._lastEventId = line.replace(/id:?\s*/, '');
      } else if (line.indexOf('id') === 0) {
        this._lastEventId = undefined;
      } else if (line === '') {
        if (data.length > 0) {
          const eventType = this._eventType || 'message';
          const event: any = {
            type: eventType,
            data: data.join('\n'),
            url: this._url,
            lastEventId: this._lastEventId,
          };

          this.dispatch(eventType, event);

          data = [];
          this._eventType = undefined;
        }
      }
    }
  }

  addEventListener<T extends EventType<E>>(type: T, listener: EventSourceListener<E, T>): void {
    if (this._eventHandlers[type] === undefined) {
      this._eventHandlers[type] = [];
    }

    this._eventHandlers[type].push(listener);
  }

  removeEventListener<T extends EventType<E>>(type: T, listener: EventSourceListener<E, T>): void {
    if (this._eventHandlers[type] !== undefined) {
      this._eventHandlers[type] = this._eventHandlers[type].filter(
        (handler: EventSourceListener<E, T>) => handler !== listener,
      );
    }
  }

  removeAllEventListeners<T extends EventType<E>>(type?: T) {
    const availableTypes = Object.keys(this._eventHandlers);

    if (type === undefined) {
      availableTypes.forEach((eventType) => {
        this._eventHandlers[eventType] = [];
      });
    } else {
      if (!availableTypes.includes(type)) {
        throw Error(`[EventSource] '${type}' type is not supported event type.`);
      }

      this._eventHandlers[type] = [];
    }
  }

  dispatch<T extends EventType<E>>(type: T, data: EventSourceEvent<T>) {
    this._eventHandlers[type]?.forEach((handler: EventSourceListener<E, T>) => handler(data));

    switch (type) {
      case 'open':
        this.onopen();
        break;
      case 'close':
        this.onclose();
        break;
      case 'error':
        this._logger?.debug(`[EventSource][dispatch][ERROR]: ${JSON.stringify(data)}`);
        this.onerror(data);
        break;
      case 'retry':
        this.onretrying(data);
        break;
      default:
        break;
    }
  }

  close() {
    this._status = this.CLOSED;
    clearTimeout(this._connectTimer);
    if (this._xhr) {
      this._xhr.abort();
    }

    this.dispatch('close', { type: 'close' });
  }

  getStatus() {
    return this._status;
  }

  onopen() {}
  onclose() {}
  onerror(_err: any) {}
  onretrying(_e: any) {}
}
