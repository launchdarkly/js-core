function canonicalizeUri(uri: string): string {
  return uri.replace(/\/+$/, '');
}

function canonicalizePath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\?$/, '');
}

/**
 * Specifies the base service URIs used by SDK components.
 */
export default class ServiceEndpoints {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  public static DEFAULT_EVENTS = 'https://events.launchdarkly.com';

  public readonly streaming: string;
  public readonly polling: string;
  public readonly events: string;
  public readonly payloadFilterKey?: string;

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
}

function getWithParams(uri: string, parameters: { key: string; value: string }[] = []) {
  if (parameters.length === 0) {
    return uri;
  }

  const parts = parameters.map(({ key, value }) => `${key}=${value}`);
  return `${uri}?${parts.join('&')}`;
}

/**
 * Get the URI for the streaming endpoint.
 *
 * @param endpoints The service endpoints.
 * @param path The path to the resource, devoid of any query parameters or hrefs.
 * @param parameters The query parameters. These query parameters must already have the appropriate encoding applied. This function WILL NOT apply it for you.
 */
export function getStreamingUri(
  endpoints: ServiceEndpoints,
  path: string,
  parameters: { key: string; value: string }[],
): string {
  const canonicalizedPath = canonicalizePath(path);

  const combinedParameters = [...parameters];
  if (endpoints.payloadFilterKey) {
    combinedParameters.push({ key: 'filter', value: endpoints.payloadFilterKey });
  }

  return getWithParams(`${endpoints.streaming}/${canonicalizedPath}`, combinedParameters);
}

/**
 * Get the URI for the polling endpoint.
 *
 * @param endpoints The service endpoints.
 * @param path The path to the resource, devoid of any query parameters or hrefs.
 * @param parameters The query parameters. These query parameters must already have the appropriate encoding applied. This function WILL NOT apply it for you.
 */
export function getPollingUri(
  endpoints: ServiceEndpoints,
  path: string,
  parameters: { key: string; value: string }[] = [],
): string {
  const canonicalizedPath = canonicalizePath(path);

  const combinedParameters = [...parameters];
  if (endpoints.payloadFilterKey) {
    combinedParameters.push({ key: 'filter', value: endpoints.payloadFilterKey });
  }

  return getWithParams(`${endpoints.polling}/${canonicalizedPath}`, combinedParameters);
}

/**
 * Get the URI for the events endpoint.
 *
 * @param endpoints The service endpoints.
 * @param path The path to the resource, devoid of any query parameters or hrefs.
 * @param parameters The query parameters. These query parameters must already have the appropriate encoding applied. This function WILL NOT apply it for you.
 */
export function getEventsUri(
  endpoints: ServiceEndpoints,
  path: string,
  parameters: { key: string; value: string }[] = [],
): string {
  const canonicalizedPath = canonicalizePath(path);

  return getWithParams(`${endpoints.events}/${canonicalizedPath}`, parameters);
}
