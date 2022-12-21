import { EventSourceInitDict, platform } from '@launchdarkly/js-server-sdk-common';

export default class FastlyEventSource implements platform.EventSource {
  private eventSourceImpl: EventSource;

  onclose: (() => void) | undefined;

  onerror: (() => void) | undefined;

  onopen: (() => void) | undefined;

  // TODO: Implement retry based on client SDK.
  onretrying: ((e: { delayMillis: number; }) => void) | undefined;

  constructor(url: string, init: EventSourceInitDict) {
    this.eventSourceImpl = new EventSource(url, init as EventSourceInit);
    this.eventSourceImpl.onopen = () => {
      this.onopen?.();
    };

    this.eventSourceImpl.onerror = () => {
      this.onerror?.();
    };
  }

  addEventListener(type: string, listener: (event?: { data?: any; } | undefined) => void): void {
    this.eventSourceImpl.addEventListener(type, listener);
  }

  close(): void {
    this.eventSourceImpl.close();
    this.close?.();
  }
}
