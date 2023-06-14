/* eslint-disable max-classes-per-file */
import { Headers, NullEventSource } from '@launchdarkly/js-server-sdk-common';
import type {
  EventSource,
  EventSourceInitDict,
  Options,
  Response,
  Requests,
} from '@launchdarkly/js-server-sdk-common';

class NoopResponse implements Response {
  headers: Headers;

  status: number;

  constructor() {
    this.headers = {} as Headers;
    this.status = 0;
  }

  /**
   * Read the response and provide it as a string.
   */
  text(): Promise<string> {
    return Promise.resolve('');
  }

  /**
   * Read the response and provide it as decoded json.
   */
  json(): Promise<any> {
    return Promise.resolve({});
  }
}

export default class EdgeRequests implements Requests {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fetch(url: string, options: Options = {}): Promise<Response> {
    return Promise.resolve(new NoopResponse());
  }

  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource {
    return new NullEventSource(url, eventSourceInitDict);
  }
}
