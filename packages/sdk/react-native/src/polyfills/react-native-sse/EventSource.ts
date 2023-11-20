/**
 * Ripped from https://github.com/binaryminds/react-native-sse
 */
import type { EventSourceEvent, EventSourceListener, EventSourceOptions, EventType } from './types';

const XMLReadyStateMap = ['UNSENT', 'OPENED', 'HEADERS_RECEIVED', 'LOADING', 'DONE'];

const defaultOptions: EventSourceOptions = {
  body: undefined,
  debug: false,
  headers: {},
  method: 'GET',
  pollingInterval: 5000,
  timeout: 0,
  timeoutBeforeConnection: 500,
  withCredentials: false,
};

export default class EventSource<E extends string = never> {
  ERROR = -1;
  CONNECTING = 0;
  OPEN = 1;
  CLOSED = 2;

  private lastEventId: undefined | string;
  private lastIndexProcessed = 0;
  private eventType: undefined | EventType<E>;
  private status = this.CONNECTING;
  private eventHandlers: any = {
    open: [],
    message: [],
    error: [],
    close: [],
  };

  private method: string;
  private timeout: number;
  private timeoutBeforeConnection: number;
  private withCredentials: boolean;
  private headers: Record<string, any>;
  private body: any;
  private debug: boolean;
  private url: string;
  private xhr: XMLHttpRequest = new XMLHttpRequest();
  private pollTimer: any;
  private pollingInterval: number;

  constructor(url: string, options?: EventSourceOptions) {
    const opts = {
      ...defaultOptions,
      ...options,
    };

    this.url = url;
    this.method = opts.method!;
    this.timeout = opts.timeout!;
    this.timeoutBeforeConnection = opts.timeoutBeforeConnection!;
    this.withCredentials = opts.withCredentials!;
    this.headers = opts.headers!;
    this.body = opts.body;
    this.debug = opts.debug!;
    this.pollingInterval = opts.pollingInterval!;

    this.pollAgain(this.timeoutBeforeConnection, true);
  }

  private pollAgain(time: number, allowZero: boolean) {
    if (time > 0 || allowZero) {
      this.logDebug(`[EventSource] Will open new connection in ${time} ms.`);
      this.pollTimer = setTimeout(() => {
        this.open();
      }, time);
    }
  }

  open() {
    try {
      this.lastIndexProcessed = 0;
      this.status = this.CONNECTING;
      this.xhr.open(this.method, this.url, true);

      if (this.withCredentials) {
        this.xhr.withCredentials = true;
      }

      this.xhr.setRequestHeader('Accept', 'text/event-stream');
      this.xhr.setRequestHeader('Cache-Control', 'no-cache');
      this.xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

      if (this.headers) {
        Object.entries(this.headers).forEach(([key, value]) => {
          this.xhr.setRequestHeader(key, value);
        });
      }

      if (typeof this.lastEventId !== 'undefined') {
        this.xhr.setRequestHeader('Last-Event-ID', this.lastEventId);
      }

      this.xhr.timeout = this.timeout;

      this.xhr.onreadystatechange = () => {
        if (this.status === this.CLOSED) {
          return;
        }

        this.logDebug(
          `[EventSource][onreadystatechange] ReadyState: ${
            XMLReadyStateMap[this.xhr.readyState] || 'Unknown'
          }(${this.xhr.readyState}), status: ${this.xhr.status}`,
        );

        if (
          this.xhr.readyState !== XMLHttpRequest.DONE &&
          this.xhr.readyState !== XMLHttpRequest.LOADING
        ) {
          return;
        }

        if (this.xhr.status >= 200 && this.xhr.status < 400) {
          if (this.status === this.CONNECTING) {
            this.status = this.OPEN;
            this.dispatch('open', { type: 'open' });
            this.logDebug('[EventSource][onreadystatechange][OPEN] Connection opened.');
          }

          this.handleEvent(this.xhr.responseText || '');

          if (this.xhr.readyState === XMLHttpRequest.DONE) {
            this.logDebug('[EventSource][onreadystatechange][DONE] Operation done.');
            this.pollAgain(this.pollingInterval, false);
          }
        } else if (this.xhr.status !== 0) {
          this.status = this.ERROR;
          this.dispatch('error', {
            type: 'error',
            message: this.xhr.responseText,
            xhrStatus: this.xhr.status,
            xhrState: this.xhr.readyState,
          });

          if (this.xhr.readyState === XMLHttpRequest.DONE) {
            this.logDebug('[EventSource][onreadystatechange][ERROR] Response status error.');
            this.pollAgain(this.pollingInterval, false);
          }
        }
      };

      this.xhr.onerror = () => {
        if (this.status === this.CLOSED) {
          return;
        }

        this.status = this.ERROR;
        this.dispatch('error', {
          type: 'error',
          message: this.xhr.responseText,
          xhrStatus: this.xhr.status,
          xhrState: this.xhr.readyState,
        });
      };

      if (this.body) {
        this.xhr.send(this.body);
      } else {
        this.xhr.send();
      }

      if (this.timeout > 0) {
        setTimeout(() => {
          if (this.xhr.readyState === XMLHttpRequest.LOADING) {
            this.dispatch('error', { type: 'timeout' });
            this.close();
          }
        }, this.timeout);
      }
    } catch (e: any) {
      this.status = this.ERROR;
      this.dispatch('error', {
        type: 'exception',
        message: e.message,
        error: e,
      });
    }
  }

  private logDebug(...msg: string[]) {
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.debug(...msg);
    }
  }

  private handleEvent(response: string) {
    const parts = response.slice(this.lastIndexProcessed).split('\n');

    const indexOfDoubleNewline = response.lastIndexOf('\n\n');
    if (indexOfDoubleNewline !== -1) {
      this.lastIndexProcessed = indexOfDoubleNewline + 2;
    }

    let data = [];
    let retry = 0;
    let line = '';

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < parts.length; i++) {
      line = parts[i].replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, '');
      if (line.indexOf('event') === 0) {
        this.eventType = line.replace(/event:?\s*/, '') as EventType<E>;
      } else if (line.indexOf('retry') === 0) {
        retry = parseInt(line.replace(/retry:?\s*/, ''), 10);
        if (!Number.isNaN(retry)) {
          this.pollingInterval = retry;
        }
      } else if (line.indexOf('data') === 0) {
        data.push(line.replace(/data:?\s*/, ''));
      } else if (line.indexOf('id:') === 0) {
        this.lastEventId = line.replace(/id:?\s*/, '');
      } else if (line.indexOf('id') === 0) {
        this.lastEventId = undefined;
      } else if (line === '') {
        if (data.length > 0) {
          const eventType = this.eventType || 'message';
          const event: any = {
            type: eventType,
            data: data.join('\n'),
            url: this.url,
            lastEventId: this.lastEventId,
          };

          this.dispatch(eventType, event);

          data = [];
          this.eventType = undefined;
        }
      }
    }
  }

  addEventListener<T extends EventType<E>>(type: T, listener: EventSourceListener<E, T>): void {
    if (this.eventHandlers[type] === undefined) {
      this.eventHandlers[type] = [];
    }

    this.eventHandlers[type].push(listener);
  }

  removeEventListener<T extends EventType<E>>(type: T, listener: EventSourceListener<E, T>): void {
    if (this.eventHandlers[type] !== undefined) {
      this.eventHandlers[type] = this.eventHandlers[type].filter(
        (handler: EventSourceListener<E, T>) => handler !== listener,
      );
    }
  }

  removeAllEventListeners<T extends EventType<E>>(type?: T) {
    const availableTypes = Object.keys(this.eventHandlers);

    if (type === undefined) {
      availableTypes.forEach((eventType) => {
        this.eventHandlers[eventType] = [];
      });
    } else {
      if (!availableTypes.includes(type)) {
        throw Error(`[EventSource] '${type}' type is not supported event type.`);
      }

      this.eventHandlers[type] = [];
    }
  }

  dispatch<T extends EventType<E>>(type: T, data: EventSourceEvent<T>) {
    const availableTypes = Object.keys(this.eventHandlers);

    if (!availableTypes.includes(type)) {
      return;
    }

    this.eventHandlers[type].forEach((handler: EventSourceListener<E, T>) => handler(data));
  }

  close() {
    this.status = this.CLOSED;
    clearTimeout(this.pollTimer);
    if (this.xhr) {
      this.xhr.abort();
    }

    this.dispatch('close', { type: 'close' });
  }
}
