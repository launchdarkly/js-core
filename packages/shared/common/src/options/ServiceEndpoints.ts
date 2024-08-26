function canonicalizeUri(uri: string): string {
  return uri.replace(/\/+$/, '');
}

/**
 * Specifies the base service URIs used by SDK components.
 */
export default class ServiceEndpoints {
  public static DEFAULT_EVENTS = 'https://events.launchdarkly.com';

  public readonly streaming: string;
  public readonly polling: string;
  public readonly events: string;
  private readonly payloadFilterKey?: string;

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

  // if true the sdk key will be included as authorization header
  public readonly includeAuthorizationHeader: boolean;

  public constructor(
    streaming: string,
    polling: string,
    events: string = ServiceEndpoints.DEFAULT_EVENTS,
    analyticsEventPath: string = '/bulk',
    diagnosticEventPath: string = '/diagnostic',
    includeAuthorizationHeader: boolean = true,
    payloadFilterKey?: string,
  ) {
    this.streaming = canonicalizeUri(streaming);
    this.polling = canonicalizeUri(polling);
    this.events = canonicalizeUri(events);
    this.analyticsEventPath = analyticsEventPath;
    this.diagnosticEventPath = diagnosticEventPath;
    this.includeAuthorizationHeader = includeAuthorizationHeader;
    this.payloadFilterKey = payloadFilterKey;
  }

  /**
   * Constructs and returns the URI to be used for a streaming connection.
   */
  public getStreamingUri(path: string): string {
    return this.getFilteredUri(`${this.streaming}${path}`);
  }

  /**
   * Constructs and returns the URI to be used for a polling connection.
   */
  public getPollingUri(path: string): string {
    return this.getFilteredUri(`${this.polling}${path}`);
  }

  /**
   * If a payload filter was present in the SDK config, this function will
   * apply that as a query parameter to the provided URI.
   *
   * If the provided uri cannot be parsed, this method will return that uri
   * unmodified.
   */
  public getFilteredUri(uri: string): string {
    if (!this.payloadFilterKey) {
      return uri;
    }

    try {
      const url = new URL(uri);
      url.searchParams.set('filter', this.payloadFilterKey);
      return url.toString();
    } catch (e) {
      return uri;
    }
  }
}
