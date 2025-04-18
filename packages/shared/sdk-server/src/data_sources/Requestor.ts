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
  private readonly _headers: Record<string, string>;

  private readonly _uri: string;

  private readonly _eTagCache: Record<
    string,
    {
      etag: string;
      body: string;
    }
  > = {};

  constructor(
    config: Configuration,
    private readonly _requests: Requests,
    baseHeaders: LDHeaders,
  ) {
    this._headers = { ...baseHeaders };
    this._uri = getPollingUri(config.serviceEndpoints, '/sdk/poll', []);
  }

  /**
   * Perform a request and utilize the ETag cache. The ETags are cached in the
   * requestor instance.
   */
  private async _requestWithETagCache(
    requestUrl: string,
    options: Options,
  ): Promise<{
    res: Response;
    body: string;
  }> {
    const cacheEntry = this._eTagCache[requestUrl];
    const cachedETag = cacheEntry?.etag;

    const updatedOptions = cachedETag
      ? {
          ...options,
          headers: { ...options.headers, 'if-none-match': cachedETag },
        }
      : options;

    const res = await this._requests.fetch(requestUrl, updatedOptions);

    if (res.status === 304 && cacheEntry) {
      return { res, body: cacheEntry.body };
    }
    const etag = res.headers.get('etag');
    const body = await res.text();
    if (etag) {
      this._eTagCache[requestUrl] = { etag, body };
    }
    return { res, body };
  }

  async requestAllData(cb: (err: any, body: any) => void) {
    const options: Options = {
      method: 'GET',
      headers: this._headers,
    };
    try {
      const { res, body } = await this._requestWithETagCache(this._uri, options);
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
