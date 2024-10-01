import {
  DataSourceErrorKind,
  getPollingUri,
  LDHeaders,
  LDPollingError,
  Options,
  Requests,
  Response,
} from '@launchdarkly/js-sdk-common';

import { LDFeatureRequestor } from '../api/subsystems';
import Configuration from '../options/Configuration';

/**
 * @internal
 */
export default class Requestor implements LDFeatureRequestor {
  private readonly headers: Record<string, string>;

  private readonly uri: string;

  private readonly eTagCache: Record<
    string,
    {
      etag: string;
      body: string;
    }
  > = {};

  constructor(
    config: Configuration,
    private readonly requests: Requests,
    baseHeaders: LDHeaders,
  ) {
    this.headers = { ...baseHeaders };
    this.uri = getPollingUri(config.serviceEndpoints, '/sdk/latest-all', []);
  }

  /**
   * Perform a request and utilize the ETag cache. The ETags are cached in the
   * requestor instance.
   */
  private async requestWithETagCache(
    requestUrl: string,
    options: Options,
  ): Promise<{
    res: Response;
    body: string;
  }> {
    const cacheEntry = this.eTagCache[requestUrl];
    const cachedETag = cacheEntry?.etag;

    const updatedOptions = cachedETag
      ? {
          ...options,
          headers: { ...options.headers, 'if-none-match': cachedETag },
        }
      : options;

    const res = await this.requests.fetch(requestUrl, updatedOptions);

    if (res.status === 304 && cacheEntry) {
      return { res, body: cacheEntry.body };
    }
    const etag = res.headers.get('etag');
    const body = await res.text();
    if (etag) {
      this.eTagCache[requestUrl] = { etag, body };
    }
    return { res, body };
  }

  async requestAllData(cb: (err: any, body: any) => void) {
    const options: Options = {
      method: 'GET',
      headers: this.headers,
    };
    try {
      const { res, body } = await this.requestWithETagCache(this.uri, options);
      if (res.status !== 200 && res.status !== 304) {
        const err = new LDPollingError(
          DataSourceErrorKind.ErrorResponse,
          `Unexpected status code: ${res.status}`,
          res.status,
        );
        return cb(err, undefined);
      }
      return cb(undefined, res.status === 304 ? null : body);
    } catch (err) {
      return cb(err, undefined);
    }
  }
}
