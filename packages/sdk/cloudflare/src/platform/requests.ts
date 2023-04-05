import type {
  EventSource,
  EventSourceInitDict,
  Options,
  Response,
  Requests,
} from '@launchdarkly/js-server-sdk-common';
import MockEventSource from './eventSource';

export default class CloudflareRequests implements Requests {
  fetch(url: string, options: Options = {}): Promise<Response> {
    return fetch(url, options);
  }

  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource {
    return new MockEventSource(url, eventSourceInitDict);
  }
}
