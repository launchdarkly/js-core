import {
  Encoding,
  getPollingUri,
  LDHeaders,
  Requests,
  ServiceEndpoints,
} from '@launchdarkly/js-sdk-common';

import { DataSourcePaths } from '../DataSourceConfig';

/**
 * Response from an FDv2 poll request, providing access to status code,
 * headers, and body.
 */
export interface FDv2PollResponse {
  status: number;
  headers: { get(name: string): string | null };
  body: string | null;
}

/**
 * Makes HTTP requests to FDv2 polling endpoints and returns full response
 * information including status code and headers.
 */
export interface FDv2Requestor {
  /**
   * Perform a poll request.
   *
   * @param basis Optional opaque state string from the most recent
   *   `payload-transferred` event, enabling delta-based updates.
   * @returns The full HTTP response.
   */
  poll(basis?: string): Promise<FDv2PollResponse>;
}

/**
 * Creates an {@link FDv2Requestor} for client-side FDv2 polling.
 *
 * @param plainContextString The JSON-serialized evaluation context.
 * @param serviceEndpoints Service endpoint configuration.
 * @param paths FDv2 polling endpoint paths.
 * @param requests Platform HTTP abstraction.
 * @param encoding Platform encoding abstraction.
 * @param baseHeaders Default HTTP headers (e.g. authorization).
 * @param baseQueryParams Additional query parameters to include on every request.
 * @param usePost If true, use POST with context in body instead of GET with
 *   context in URL path.
 */
export function makeFDv2Requestor(
  plainContextString: string,
  serviceEndpoints: ServiceEndpoints,
  paths: DataSourcePaths,
  requests: Requests,
  encoding: Encoding,
  baseHeaders?: LDHeaders,
  baseQueryParams?: { key: string; value: string }[],
  usePost?: boolean,
): FDv2Requestor {
  const headers: { [key: string]: string } = { ...baseHeaders };

  let body: string | undefined;
  let method = 'GET';
  let path: string;

  if (usePost) {
    method = 'POST';
    headers['content-type'] = 'application/json';
    body = plainContextString;
    path = paths.pathPost(encoding, plainContextString);
  } else {
    path = paths.pathGet(encoding, plainContextString);
  }

  return {
    async poll(basis?: string): Promise<FDv2PollResponse> {
      const parameters: { key: string; value: string }[] = [...(baseQueryParams ?? [])];
      if (basis) {
        parameters.push({ key: 'basis', value: basis });
      }

      const uri = getPollingUri(serviceEndpoints, path, parameters);

      const res = await requests.fetch(uri, {
        method,
        headers,
        body,
      });

      const responseBody = res.status === 304 ? null : await res.text();

      return {
        status: res.status,
        headers: res.headers,
        body: responseBody,
      };
    },
  };
}
