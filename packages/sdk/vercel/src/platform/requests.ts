/* eslint-disable class-methods-use-this */
// TODO: DRY out vercel/cloudflare/shared stuff
import type {
  EventSource,
  EventSourceInitDict,
  Options,
  Response,
  Requests,
} from '@launchdarkly/js-server-sdk-common';
import MockEventSource from './eventSource';

export default class VercelRequests implements Requests {
  fetch(url: string, options: Options = {}): Promise<Response> {
    // Think this should be available to us in Edge Workers/middleware
    // TODO: Use tsconfig instead of ts-ignore
    // @ts-ignore
    return fetch(url, options);
  }

  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource {
    return new MockEventSource(url, eventSourceInitDict);
  }
}
