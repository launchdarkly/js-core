// eslint-disable-next-line max-classes-per-file
import {
  Encoding,
  getPollingUri,
  HttpErrorResponse,
  LDHeaders,
  Requests,
  ServiceEndpoints,
} from '@launchdarkly/js-sdk-common';

import { DataSourcePaths } from './DataSourceConfig';

function isOk(status: number) {
  return status >= 200 && status <= 299;
}

export class LDRequestError extends Error implements HttpErrorResponse {
  public status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
    this.name = 'LaunchDarklyRequestError';
  }
}

/**
 * Note: The requestor is implemented independently from polling such that it can be used to
 * make a one-off request.
 */
export default class Requestor {
  constructor(
    private requests: Requests,
    private readonly uri: string,
    private readonly headers: { [key: string]: string },
    private readonly method: string,
    private readonly body?: string,
  ) {}

  async requestPayload(): Promise<string> {
    let status: number | undefined;
    try {
      const res = await this.requests.fetch(this.uri, {
        method: this.method,
        headers: this.headers,
        body: this.body,
      });
      if (isOk(res.status)) {
        return await res.text();
      }
      // Assigning so it can be thrown after the try/catch.
      status = res.status;
    } catch (err: any) {
      throw new LDRequestError(err?.message);
    }
    throw new LDRequestError(`Unexpected status code: ${status}`, status);
  }
}

export function makeRequestor(
  plainContextString: string,
  serviceEndpoints: ServiceEndpoints,
  paths: DataSourcePaths,
  requests: Requests,
  encoding: Encoding,
  baseHeaders?: LDHeaders,
  baseQueryParams?: { key: string; value: string }[],
  withReasons?: boolean,
  useReport?: boolean,
  secureModeHash?: string,
) {
  let body;
  let method = 'GET';
  const headers: { [key: string]: string } = { ...baseHeaders };

  if (useReport) {
    method = 'REPORT';
    headers['content-type'] = 'application/json';
    body = plainContextString; // context is in body for REPORT
  }

  const path = useReport
    ? paths.pathReport(encoding, plainContextString)
    : paths.pathGet(encoding, plainContextString);

  const parameters: { key: string; value: string }[] = [...(baseQueryParams ?? [])];
  if (withReasons) {
    parameters.push({ key: 'withReasons', value: 'true' });
  }
  if (secureModeHash) {
    parameters.push({ key: 'h', value: secureModeHash });
  }

  const uri = getPollingUri(serviceEndpoints, path, parameters);
  return new Requestor(requests, uri, headers, method, body);
}
