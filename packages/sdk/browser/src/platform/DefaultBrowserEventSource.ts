import {
  DefaultBackoff,
  EventListener,
  EventName,
  EventSourceInitDict,
  EventSourceRetryDelayStrategy,
  HttpErrorResponse,
  EventSource as LDEventSource,
  monotonicNow,
} from '@launchdarkly/js-client-sdk-common';

/**
 * Implementation Notes:
 *
 * This event source does not support a read-timeout.
 * This event source does not support customized verbs.
 * This event source does not support headers.
 */

/**
 * Browser event source implementation which extends the built-in event
 * source with additional reconnection logic.
 */
export default class DefaultBrowserEventSource implements LDEventSource {
  private _es?: EventSource;
  private _backoff: DefaultBackoff;
  private _errorFilter: (err: HttpErrorResponse) => boolean;
  private _urlBuilder?: () => string;
  private _retryDelayStrategy?: EventSourceRetryDelayStrategy;

  // Whether at least one event has been received on the current connection.
  // Used to anchor the retry strategy's healthy-reset clock on first data
  // rather than on open.
  private _receivedEventThisConnection = false;

  // The type of the handle can be platform specific and we treat is opaquely.
  private _reconnectTimeoutHandle?: any;

  private _listeners: Record<string, EventListener[]> = {};

  constructor(
    private _url: string,
    options: EventSourceInitDict,
  ) {
    this._backoff = new DefaultBackoff(
      options.initialRetryDelayMillis ?? 1000,
      options.retryResetIntervalMillis ?? 60 * 1000,
    );
    this._errorFilter = options.errorFilter;
    this._urlBuilder = options.urlBuilder;
    this._retryDelayStrategy = options.retryDelayStrategy;
    this._openConnection();
  }

  onclose: (() => void) | undefined;

  onerror: ((err?: HttpErrorResponse) => void) | undefined;

  onopen: (() => void) | undefined;

  onretrying: ((e: { delayMillis: number }) => void) | undefined;

  private _openConnection() {
    if (this._urlBuilder) {
      this._url = this._urlBuilder();
    }
    this._receivedEventThisConnection = false;
    this._es = new EventSource(this._url);
    this._es.onopen = () => {
      this._backoff.success();
      this.onopen?.();
    };
    // The error could be from a polyfill, or from the browser event source, so we are loose on the
    // typing.
    this._es.onerror = (err: any) => {
      // In browsers, a server-sent "event: error" SSE message fires both
      // addEventListener('error', ...) AND onerror. We must not treat it as a
      // connection failure. A server-sent error arrives as a MessageEvent while
      // the connection is still open; a real connection error is a plain Event
      // with readyState !== OPEN.
      if (err instanceof MessageEvent) {
        return;
      }
      this._handleError(err);
      this.onerror?.(err);
    };
    Object.entries(this._listeners).forEach(([eventName, listeners]) => {
      listeners.forEach((listener) => {
        this._attachListener(eventName, listener);
      });
    });
  }

  /**
   * Attaches a listener to the underlying event source, anchoring the retry
   * strategy's healthy-reset clock on the first event received over the
   * connection (data delivery) rather than on open. A connection that opens
   * but never delivers data must not reset the retry regime; this matches the
   * shared eventsource transport used by the non-browser client SDKs.
   */
  private _attachListener(type: EventName, listener: EventListener) {
    this._es?.addEventListener(type, (event: any) => {
      if (!this._receivedEventThisConnection) {
        this._receivedEventThisConnection = true;
        // Use a monotonic clock so the strategy's healthy-reset window is
        // immune to wall-clock/NTP shifts, matching the shared eventsource
        // transport used by the non-browser client SDKs.
        this._retryDelayStrategy?.setGoodSince(monotonicNow());
      }
      listener(event);
    });
  }

  addEventListener(type: EventName, listener: EventListener): void {
    this._listeners[type] ??= [];
    this._listeners[type].push(listener);
    this._attachListener(type, listener);
  }

  close(): void {
    // Ensure any pending retry attempts are not done.
    clearTimeout(this._reconnectTimeoutHandle);
    this._reconnectTimeoutHandle = undefined;

    // Close the event source and notify any listeners.
    this._es?.close();
    this.onclose?.();
  }

  private _tryConnect(delayMs: number) {
    this.onretrying?.({ delayMillis: delayMs });
    this._reconnectTimeoutHandle = setTimeout(() => {
      this._openConnection();
    }, delayMs);
  }

  private _handleError(err: any): void {
    this.close();

    // The event source may not produce a status. But the LaunchDarkly polyfill
    // can. When a status is available, the error filter classifies the failure
    // (recording it on the injected retry-delay strategy) and decides whether
    // the condition is terminal.
    if (typeof err.status === 'number') {
      if (!this._errorFilter(err)) {
        // Unrecoverable per the filter: do not retry.
        return;
      }
      // The filter just advanced the strategy; reconnect on its computed delay
      // (the extended regime for an unexpected status), falling back to the
      // built-in backoff when no strategy was injected.
      this._tryConnect(
        this._retryDelayStrategy?.nextRetryDelay(monotonicNow()) ?? this._backoff.fail(),
      );
      return;
    }

    // A native EventSource error carries no status, so the filter cannot
    // classify it and the strategy is not advanced; use the built-in backoff.
    this._tryConnect(this._backoff.fail());
  }
}
