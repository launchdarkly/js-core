function canonicalizeUri(uri: string): string {
  return uri.replace(/\/+$/, '');
}

/**
 * Specifies the base service URIs used by SDK components.
 */
export default class ServiceEndpoints {
  public readonly streaming: string;

  public readonly polling: string;

  public readonly events: string;

  /** Valid paths are:
   * /bulk
   * /events/bulk/envId
   * /mobile
   */
  public readonly analyticsEventPath: string;

  /** Valid paths are:
   * /diagnostic
   * /events/diagnostic/envId
   * /mobile/events/diagnostic
   */
  public readonly diagnosticEventPath: string;

  public constructor(
    streaming: string,
    polling: string,
    events: string,
    analyticsEventPath: string = '/bulk',
    diagnosticEventPath: string = '/diagnostic',
  ) {
    this.streaming = canonicalizeUri(streaming);
    this.polling = canonicalizeUri(polling);
    this.events = canonicalizeUri(events);
    this.analyticsEventPath = analyticsEventPath;
    this.diagnosticEventPath = diagnosticEventPath;
  }
}
