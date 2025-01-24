import { EdgeProvider } from '.';

/**
 * Wraps around an edge provider to cache a copy of the sdk payload locally an explicit request is made to refetch data from the origin.
 * The wrapper is necessary to ensure that we don't make redundant sub-requests from Akamai to fetch an entire environment payload.
 */
export default class CacheableStoreProvider implements EdgeProvider {
  cache: string | null | undefined;

  constructor(private readonly _edgeProvider: EdgeProvider) {}

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
}
