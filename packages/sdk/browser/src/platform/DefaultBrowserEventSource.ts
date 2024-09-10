import {
  EventListener,
  EventName,
  EventSourceInitDict,
  HttpErrorResponse,
  EventSource as LDEventSource,
} from '@launchdarkly/js-client-sdk-common';

import Backoff from './Backoff';

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
  private es?: EventSource;
  private backoff: Backoff;
  private errorFilter: (err: HttpErrorResponse) => boolean;

  // The type of the handle can be platform specific and we treat is opaquely.
  private reconnectTimeoutHandle?: any;

  private listeners: Record<string, EventListener[]> = {};

  constructor(
    private readonly url: string,
    options: EventSourceInitDict,
  ) {
    this.backoff = new Backoff(options.initialRetryDelayMillis);
    this.errorFilter = options.errorFilter;
    this.openConnection();
  }

  onclose: (() => void) | undefined;

  onerror: ((err?: HttpErrorResponse) => void) | undefined;

  onopen: (() => void) | undefined;

  onretrying: ((e: { delayMillis: number }) => void) | undefined;

  private openConnection() {
    this.es = new EventSource(this.url);
    this.es.onopen = () => {
      this.backoff.reset();
      this.onopen?.();
    };
    // The error could be from a polyfill, or from the browser event source, so we are loose on the
    // typing.
    this.es.onerror = (err: any) => {
      this.handleError(err);
      this.onerror?.(err);
    };
    Object.entries(this.listeners).forEach(([eventName, listeners]) => {
      listeners.forEach((listener) => {
        this.es?.addEventListener(eventName, listener);
      });
    });
  }

  addEventListener(type: EventName, listener: EventListener): void {
    this.listeners[type] ??= [];
    this.listeners[type].push(listener);
    this.es?.addEventListener(type, listener);
  }

  close(): void {
    // Ensure any pending retry attempts are not done.
    clearTimeout(this.reconnectTimeoutHandle);
    this.reconnectTimeoutHandle = undefined;

    // Close the event source and notify any listeners.
    this.es?.close();
    this.onclose?.();
  }

  private tryConnect(delayMs: number) {
    this.onretrying?.({ delayMillis: delayMs });
    this.reconnectTimeoutHandle = setTimeout(() => {
      this.openConnection();
    }, delayMs);
  }

  private handleError(err: any): void {
    this.close();

    // The event source may not produce a status. But the LaunchDarkly
    // polyfill can. If we can get the status, then we should stop retrying
    // on certain error codes.
    if (err.status && typeof err.status === 'number' && !this.errorFilter(err)) {
      // If we encounter an unrecoverable condition, then we do not want to
      // retry anymore.
      return;
    }

    const delay = this.backoff.getNextRetryDelay();
    this.tryConnect(delay);
  }
}
