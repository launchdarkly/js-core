import { EventSource, EventSourceInitDict } from '../src/platform';

export default class MockEventSource implements EventSource {
  handlers: Record<string, (event?: { data?: any; }) => void> = {};

  closed = false;

  url: string;

  options: EventSourceInitDict;

  constructor(url: string, options: EventSourceInitDict) {
    this.url = url;
    this.options = options;
  }

  onclose: (() => void) | undefined;

  onerror: (() => void) | undefined;

  onopen: (() => void) | undefined;

  onretrying: ((e: { delayMillis: number; }) => void) | undefined;

  addEventListener(type: string, listener: (event?: { data?: any; }) => void): void {
    this.handlers[type] = listener;
  }

  close(): void {
    this.closed = true;
  }

  simulateError(error: { status: number; message: string; }) {
    const shouldRetry = this.options.errorFilter(error);
    if (!shouldRetry) {
      this.closed = true;
    }
  }
}
