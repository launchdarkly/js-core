import {
  EventSourceInitDict,
  EventSource as LDEventSource,
  Options,
  Requests,
  Response,
} from '@launchdarkly/js-client-sdk-common';

import BrowserEventSourceShim from './BrowserEventSourceShim';

export default class BrowserRequests implements Requests {
  fetch(url: string, options?: Options): Promise<Response> {
    return this.fetch(url, options);
  }
  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): LDEventSource {
    return new BrowserEventSourceShim(url, eventSourceInitDict);
  }
}
