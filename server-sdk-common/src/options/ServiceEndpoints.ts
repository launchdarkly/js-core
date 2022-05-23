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

  public constructor(streaming: string, polling: string, events: string) {
    this.streaming = canonicalizeUri(streaming);
    this.polling = canonicalizeUri(polling);
    this.events = canonicalizeUri(events);
  }
}
