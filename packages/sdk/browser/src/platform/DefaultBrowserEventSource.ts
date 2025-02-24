import {
  EventListener,
  EventName,
  EventSourceInitDict,
  HttpErrorResponse,
  EventSource as LDEventSource,
} from '@launchdarkly/js-client-sdk-common';
import { DefaultBackoff } from '@launchdarkly/js-sdk-common';

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

  // The type of the handle can be platform specific and we treat is opaquely.
  private _reconnectTimeoutHandle?: any;

  private _listeners: Record<string, EventListener[]> = {};

  constructor(
    private readonly _url: string,
    options: EventSourceInitDict,
  ) {
    this._backoff = new DefaultBackoff(
      options.initialRetryDelayMillis,
      options.retryResetIntervalMillis,
    );
    this._errorFilter = options.errorFilter;
    this._openConnection();
  }

  onclose: (() => void) | undefined;

  onerror: ((err?: HttpErrorResponse) => void) | undefined;

  onopen: (() => void) | undefined;

  onretrying: ((e: { delayMillis: number }) => void) | undefined;

  private _openConnection() {
    this._es = new EventSource(this._url);
    this._es.onopen = () => {
      this._backoff.success();
      this.onopen?.();
    };
    // The error could be from a polyfill, or from the browser event source, so we are loose on the
    // typing.
    this._es.onerror = (err: any) => {
      this._handleError(err);
      this.onerror?.(err);
    };
    Object.entries(this._listeners).forEach(([eventName, listeners]) => {
      listeners.forEach((listener) => {
        this._es?.addEventListener(eventName, listener);
      });
    });
  }

  addEventListener(type: EventName, listener: EventListener): void {
    this._listeners[type] ??= [];
    this._listeners[type].push(listener);
    this._es?.addEventListener(type, listener);
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

    // The event source may not produce a status. But the LaunchDarkly
    // polyfill can. If we can get the status, then we should stop retrying
    // on certain error codes.
    if (err.status && typeof err.status === 'number' && !this._errorFilter(err)) {
      // If we encounter an unrecoverable condition, then we do not want to
      // retry anymore.
      return;
    }

    this._tryConnect(this._backoff.fail());
  }
}
