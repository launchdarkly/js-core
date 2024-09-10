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

export default class BrowserEventSourceShim implements LDEventSource {
  private es?: EventSource;
  private backoff: Backoff;
  private errorFilter: (err: HttpErrorResponse) => boolean;

  // The type of the handle can be platform specific and we treat is opaquely.
  private reconnectTimeoutHandle?: any;

  constructor(
    private readonly url: string,
    options: EventSourceInitDict,
  ) {
    this.backoff = new Backoff(options.initialRetryDelayMillis);
    this.errorFilter = options.errorFilter;
    this.createEventSource();
  }

  onclose: (() => void) | undefined;

  onerror: ((err?: HttpErrorResponse) => void) | undefined;

  onopen: (() => void) | undefined;

  onretrying: ((e: { delayMillis: number }) => void) | undefined;

  private createEventSource() {
    this.es = new EventSource(this.url);
    this.es.onopen = () => {
      this.backoff.reset();
      this.onopen?.();
    };
    // The error could be from a polyfill, or from the browser event source, so we are loose on the
    // typing.
    this.es.onerror = (err: any) => {
      this.handleError(err);
    };
  }

  addEventListener(type: EventName, listener: EventListener): void {
    // TODO: Cache listeners so they can be re-added.
    this.es?.addEventListener(type, listener);
  }

  close(): void {
    // Ensure any pending retry attempts are not done.
    clearTimeout(this.reconnectTimeoutHandle);
    this.reconnectTimeoutHandle = undefined;
    this.es?.close();
  }

  private tryConnect(delayMs: number) {
    this.reconnectTimeoutHandle = setTimeout(() => {
      this.createEventSource();
    }, delayMs);
  }

  private handleError(err: any): void {
    // The event source may not produce a status. But the LaunchDarkly
    // polyfill can. If we can get the status, then we should stop retrying
    // on certain error codes.
    if (err.status && typeof err.status === 'number' && !this.errorFilter(err)) {
      // If we encounter an unrecoverable condition, then we do not want to
      // retry anymore.
      this.close();
      return;
    }

    const delay = this.backoff.getNextRetryDelay();

    this.close();
    this.tryConnect(delay);
  }
}
