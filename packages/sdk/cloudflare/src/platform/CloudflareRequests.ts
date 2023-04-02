/* eslint-disable class-methods-use-this */
import type {
  EventSource,
  EventSourceInitDict,
  Options,
  Response,
  Requests,
} from '@launchdarkly/js-server-sdk-common';
import { EventSource as LDEventSource } from 'launchdarkly-eventsource';

export default class CloudflareRequests implements Requests {
  fetch(url: string, options: Options = {}): Promise<Response> {
    return fetch(url, options);
  }

  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource {
    const expandedOptions = {
      ...eventSourceInitDict,
      // agent: this.agent,
      // tlsParams: this.tlsOptions,
    };
    return new LDEventSource(url, expandedOptions);
  }
}
