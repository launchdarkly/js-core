import type {
  EventName,
  EventSource,
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
      method: eventSourceInitDict.method,
      headers: eventSourceInitDict.headers,
      body: eventSourceInitDict.body,
      retryAndHandleError: eventSourceInitDict.errorFilter,
      logger: this.logger,
    });
  }

  fetch(url: string, options?: Options): Promise<Response> {
    // @ts-ignore
    return fetch(url, options);
  }
}
