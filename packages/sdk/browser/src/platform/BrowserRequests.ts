import {
  EventSourceCapabilities,
  EventSourceInitDict,
  EventSource as LDEventSource,
  Options,
  Requests,
  Response,
} from '@launchdarkly/js-client-sdk-common';

import DefaultBrowserEventSource from './DefaultBrowserEventSource';

export default class BrowserRequests implements Requests {
  fetch(url: string, options?: Options): Promise<Response> {
    delete options?.compressBodyIfPossible;
    // @ts-ignore
    return fetch(url, options);
  }

  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): LDEventSource {
    return new DefaultBrowserEventSource(url, eventSourceInitDict);
  }

  getEventSourceCapabilities(): EventSourceCapabilities {
    return {
      customMethod: false,
      readTimeout: false,
      headers: false,
    };
  }
}
