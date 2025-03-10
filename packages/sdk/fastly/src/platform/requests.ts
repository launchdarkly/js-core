/// <reference types="@fastly/js-compute" />
import { NullEventSource } from '@launchdarkly/js-server-sdk-common';
import type {
  EventSource,
  EventSourceCapabilities,
  EventSourceInitDict,
  Options,
  Requests,
  Response,
} from '@launchdarkly/js-server-sdk-common';

export default class EdgeRequests implements Requests {
  eventsBackend: string;

  constructor(eventsBackend: string) {
    this.eventsBackend = eventsBackend;
  }

  fetch(url: string, options: Options = {}): Promise<Response> {
    return fetch(url, { ...options, backend: this.eventsBackend });
  }

  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource {
    return new NullEventSource(url, eventSourceInitDict);
  }

  getEventSourceCapabilities(): EventSourceCapabilities {
    return {
      readTimeout: false,
      headers: false,
      customMethod: false,
    };
  }
}
