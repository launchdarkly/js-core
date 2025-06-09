import {
  DataSourceErrorKind,
  getPollingUri,
  LDFlagDeliveryFallbackError,
  LDHeaders,
  LDLogger,
  LDPollingError,
  Options,
  Requests,
  Response,
  ServiceEndpoints,
} from '@launchdarkly/js-sdk-common';

import { LDFeatureRequestor } from '../api/subsystems';
import Configuration from '../options/Configuration';

/**
 * @internal
 */
export default class Requestor implements LDFeatureRequestor {
  private readonly _headers: Record<string, string>;
  private readonly _serviceEndpoints: ServiceEndpoints;
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
    private readonly _path: string = '/sdk/latest-all',
    private readonly _logger?: LDLogger,
  ) {
    this._headers = { ...baseHeaders };
    this._serviceEndpoints = config.serviceEndpoints;
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

  async requestAllData(
    cb: (err: any, body: any, headers: any) => void,
    queryParams: { key: string; value: string }[] = [],
  ) {
    const options: Options = {
      method: 'GET',
      headers: this._headers,
    };

    const uri = getPollingUri(this._serviceEndpoints, this._path, queryParams);
    this._logger?.debug(`Requestor making request to uri: ${uri}`);

    try {
      const { res, body } = await this._requestWithETagCache(uri, options);
      this._logger?.debug(`Requestor got (possibly cached) body: ${JSON.stringify(body)}`);

      if (res.headers.get(`x-ld-fd-fallback`) === `true`) {
        const err = new LDFlagDeliveryFallbackError(
          DataSourceErrorKind.ErrorResponse,
          `Response header indicates to fallback to FDv1.`,
          res.status,
        );
        return cb(err, undefined, undefined);
      }

      if (res.status !== 200 && res.status !== 304) {
        const err = new LDPollingError(
          DataSourceErrorKind.ErrorResponse,
          `Unexpected status code: ${res.status}`,
          res.status,
        );
        return cb(err, undefined, undefined);
      }
      return cb(
        undefined,
        res.status === 304 ? null : body,
        Object.fromEntries(res.headers.entries()),
      );
    } catch (err) {
      return cb(err, undefined, undefined);
    }
  }
}
