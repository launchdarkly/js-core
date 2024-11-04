import { EventSource, EventSourceInitDict } from '@launchdarkly/js-sdk-common';

export class MockEventSource implements EventSource {
  eventsByType: Map<string, { data?: any }[]> = new Map<string, { data?: any }[]>();

  handlers: Record<string, (event?: { data?: any }) => void> = {};

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

  onretrying: ((e: { delayMillis: number }) => void) | undefined;

  addEventListener(type: string, listener: (event?: { data?: any }) => void): void {
    this.handlers[type] = listener;

    // replay events to listener
    (this.eventsByType.get(type) ?? []).forEach((event) => {
      listener(event);
    });
  }

  close(): void {
    this.closed = true;
  }

  simulateEvents(type: string, events: { data?: any }[]) {
    this.eventsByType.set(type, events);
  }

  simulateError(error: { status: number; message: string }) {
    const shouldRetry = this.options.errorFilter(error);
    if (!shouldRetry) {
      this.closed = true;
    }
  }
}
