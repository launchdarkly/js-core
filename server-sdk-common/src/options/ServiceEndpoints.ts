import { LDOptions } from '../api';
import TypeValidators from './validators';
import valueOrDefault from './valueOrDefault';

/**
 * DefaultStreamingBaseURI is the default base URI of the streaming service.
*/
const DefaultStreamingBaseURI = 'https://stream.launchdarkly.com/';

/**
 * DefaultPollingBaseURI is the default base URI of the polling service.
 */
const DefaultPollingBaseURI = 'https://sdk.launchdarkly.com/';

/**
 * DefaultEventsBaseURI is the default base URI of the events service.
 */
const DefaultEventsBaseURI = 'https://events.launchdarkly.com/';

function canonicalizeUri(uri: string): string {
  return uri.replace(/\/+$/, '');
}

/**
 * Specifies the base service URIs used by SDK components.
 *
 * @internal
 */
export default class ServiceEndpoints {
  private streaming: string;

  private polling: string;

  private events: string;

  public get streamUri() { return this.streaming; }

  public get pollingUri() { return this.polling; }

  public get eventsUri() { return this.events; }

  private constructor(streaming: string, polling: string, events: string) {
    this.streaming = canonicalizeUri(streaming);
    this.polling = canonicalizeUri(polling);
    this.events = canonicalizeUri(events);
  }

  public static FromOptions(options: LDOptions): ServiceEndpoints {
    const { baseUri, streamUri, eventsUri } = options;

    return new ServiceEndpoints(
      valueOrDefault(streamUri, DefaultStreamingBaseURI),
      valueOrDefault(baseUri, DefaultPollingBaseURI),
      valueOrDefault(eventsUri, DefaultEventsBaseURI),
    );
  }
}
