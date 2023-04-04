// TODO: Dry this file duplicated in this repo
import type { EventSource, EventSourceInitDict } from '@launchdarkly/js-sdk-common';

export default class MockEventSource implements EventSource {
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
  }

  close(): void {
    this.closed = true;
  }
}
