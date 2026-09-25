import {
  EventSourceCapabilities,
  EventSourceInitDict,
  EventSource as LDEventSource,
  LDEventSourceFactory,
  Options,
  Requests,
  Response,
} from '@launchdarkly/js-client-sdk-common';

import DefaultBrowserEventSource from './DefaultBrowserEventSource';

/**
 * The native browser EventSource, which this SDK uses unless an override is configured, supports
 * none of the optional transport features.
 */
const DEFAULT_CAPABILITIES: EventSourceCapabilities = {
  customMethod: false,
  readTimeout: false,
  headers: false,
};

const defaultEventSourceFactory: LDEventSourceFactory = {
  createEventSource: (url: string, eventSourceInitDict: EventSourceInitDict): LDEventSource =>
    new DefaultBrowserEventSource(url, eventSourceInitDict),
  capabilities: DEFAULT_CAPABILITIES,
};

export default class BrowserRequests implements Requests {
  private _eventSourceFactory: LDEventSourceFactory;

  /**
   * @param eventSourceFactory Optional override for the EventSource implementation. When omitted,
   * the native browser EventSource is used.
   */
  constructor(eventSourceFactory?: LDEventSourceFactory) {
    this._eventSourceFactory = eventSourceFactory ?? defaultEventSourceFactory;
  }

  fetch(url: string, options?: Options): Promise<Response> {
    // @ts-ignore
    return fetch(url, options);
  }

  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): LDEventSource {
    return this._eventSourceFactory.createEventSource(url, eventSourceInitDict);
  }

  getEventSourceCapabilities(): EventSourceCapabilities {
    return { ...(this._eventSourceFactory.capabilities ?? DEFAULT_CAPABILITIES) };
  }
}
