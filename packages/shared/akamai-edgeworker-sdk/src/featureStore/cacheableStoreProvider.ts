import { EdgeProvider } from '.';

/**
 * Wraps around an edge provider to cache a copy of the sdk payload locally an explicit request is made to refetch data from the origin.
 * The wrapper is neccessary to ensure that we dont make redundant sub-requests from Akamai to fetch an entire environment payload.
 */
export default class CacheableStoreProvider implements EdgeProvider {
  cache: string | null | undefined;

  constructor(
    private readonly _edgeProvider: EdgeProvider,
    private readonly _rootKey: string,
  ) {}

  /**
   * Get data from the edge provider feature store.
   * @param rootKey
   * @returns
   */
  async get(rootKey: string): Promise<string | null | undefined> {
    if (!this.cache) {
      this.cache = await this._edgeProvider.get(rootKey);
    }

    return this.cache;
  }

  /**
   * Invalidates cache and fetch environment payload data from origin. The result of this data is cached in memory.
   * You should only call this function within a feature store to pre-fetch and cache payload data in environments
   * where its expensive to make multiple outbound requests to the origin
   * @param rootKey
   * @returns
   */
  async prefetchPayloadFromOriginStore(rootKey?: string): Promise<string | null | undefined> {
    this.cache = undefined; // clear the cache so that new data can be fetched from the origin
    return this.get(rootKey || this._rootKey);
  }
}
