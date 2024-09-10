import type {
  EventName,
  EventSource,
  EventSourceCapabilities,
  EventSourceInitDict,
  LDLogger,
  Options,
  Requests,
  Response,
} from '@launchdarkly/js-client-sdk-common';

import RNEventSource from '../fromExternal/react-native-sse';

export default class PlatformRequests implements Requests {
  constructor(private readonly logger: LDLogger) {}

  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource {
    return new RNEventSource<EventName>(url, {
      headers: eventSourceInitDict.headers,
      retryAndHandleError: eventSourceInitDict.errorFilter,
      logger: this.logger,
    });
  }

  getEventSourceCapabilities(): EventSourceCapabilities {
    return {
      readTimeout: false,
      headers: true,
      customVerb: true,
    };
  }

  fetch(url: string, options?: Options): Promise<Response> {
    // @ts-ignore
    return fetch(url, options);
  }
}
