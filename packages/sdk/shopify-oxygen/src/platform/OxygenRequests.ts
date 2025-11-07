import { NullEventSource } from '@launchdarkly/js-server-sdk-common';
import type {
  EventSource,
  EventSourceCapabilities,
  EventSourceInitDict,
  Options,
  platform,
} from '@launchdarkly/js-server-sdk-common';

export default class OxygenRequests implements platform.Requests {
  async fetch(url: string, options: Options = {}): Promise<platform.Response> {
    return fetch(url, options);
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
