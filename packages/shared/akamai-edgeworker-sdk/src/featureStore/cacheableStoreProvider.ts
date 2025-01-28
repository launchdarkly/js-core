import { EdgeProvider } from '.';

/**
 * Wraps around an edge provider to cache a copy of the SDK payload locally.
 *
 * If a cacheTtlMs is specified, then the cacheable store provider will cache
 * results for that specified duration. If the data lookup fails after that
 * interval, previously stored values will be retained. The lookup will be
 * retried again after the TTL.
 *
 * If no cacheTtlMs is specified, the cache will be stored for the lifetime of
 * the object. The cache can be manually refreshed by calling
 * `prefetchPayloadFromOriginStore`.
 *
 * The wrapper is necessary to ensure that we don't make redundant sub-requests
 * from Akamai to fetch an entire environment payload. At the time of this writing,
 * the Akamai documentation (https://techdocs.akamai.com/edgeworkers/docs/resource-tier-limitations)
 * limits the number of sub-requests to:
 *
 * - 2 for basic compute
 * - 4 for dynamic compute
 * - 10 for enterprise
 */
export default class CacheableStoreProvider implements EdgeProvider {
  cache: string | null | undefined;
  cachedAt: number | undefined;

  constructor(
    private readonly _edgeProvider: EdgeProvider,
    private readonly _rootKey: string,
    private readonly _cacheTtlMs?: number,
  ) {}

  /**
   * Get data from the edge provider feature store.
   * @param rootKey
   * @returns
   */
  async get(rootKey: string): Promise<string | null | undefined> {
    if (!this._isCacheValid()) {
      const updatedResults = await this._edgeProvider.get(rootKey);
      if (updatedResults !== undefined) {
        this.cache = updatedResults;
      }
      this.cachedAt = Date.now();
    }

    return this.cache;
  }

  /**
   * Fetches environment payload data from the origin in accordance with the caching configuration.
   *
   * You should only call this function within a feature store to pre-fetch and cache payload data in environments
   * where its expensive to make multiple outbound requests to the origin
   * @param rootKey
   * @returns
   */
  async prefetchPayloadFromOriginStore(rootKey?: string): Promise<string | null | undefined> {
    if (this._cacheTtlMs === undefined) {
      this.cache = undefined; // clear the cache so that new data can be fetched from the origin
    }

    return this.get(rootKey || this._rootKey);
  }

  /**
   * Internal helper to determine if the cached values are still considered valid.
   */
  private _isCacheValid(): boolean {
    // If we don't have a cache, or we don't know how old the cache is, we have
    // to consider it is invalid.
    if (!this.cache || !this.cachedAt) {
      return false;
    }

    // If the cache provider was configured without a TTL, then the cache is
    // always considered valid.
    if (!this._cacheTtlMs) {
      return true;
    }

    // Otherwise, it all depends on the time.
    return Date.now() - this.cachedAt < this._cacheTtlMs;
  }
}
