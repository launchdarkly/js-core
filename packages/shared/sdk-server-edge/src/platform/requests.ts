import { NullEventSource } from '@launchdarkly/js-server-sdk-common';
import type {
  EventSource,
  EventSourceInitDict,
  Options,
  Requests,
  Response,
} from '@launchdarkly/js-server-sdk-common';

export default class EdgeRequests implements Requests {
  fetch(url: string, options: Options = {}): Promise<Response> {
    // @ts-ignore
    return fetch(url, options);
  }

  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource {
    return new NullEventSource(url, eventSourceInitDict);
  }
}
