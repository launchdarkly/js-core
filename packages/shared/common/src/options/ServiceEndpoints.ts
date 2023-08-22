function canonicalizeUri(uri: string): string {
  return uri.replace(/\/+$/, '');
}

/**
 * Specifies the base service URIs used by SDK components.
 */
export default class ServiceEndpoints {
  public static DEFAULT_POLLING = 'https://sdk.launchdarkly.com';
  public static DEFAULT_EVENTS = 'https://events.launchdarkly.com';

  public readonly streaming: string;
  public readonly polling: string;
  public readonly events: string;
  public constructor(
    streaming: string,
    polling: string = ServiceEndpoints.DEFAULT_POLLING,
    events: string = ServiceEndpoints.DEFAULT_EVENTS,
  ) {
    this.streaming = canonicalizeUri(streaming);
    this.polling = canonicalizeUri(polling);
    this.events = canonicalizeUri(events);
  }
}
