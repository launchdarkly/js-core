import { CacheItem } from './cache-item';

export default class Cache {
  cache: CacheItem | undefined;
  cachedAt: number | undefined;

  constructor(private readonly _cacheTtlMs: number) {}

  get(): any | undefined {
    // If the cacheTtlMs is less than 0, the cache is disabled.
    if (this._cacheTtlMs < 0) {
      return undefined;
    }

    // If there isn't a cached item, we must return undefined.
    if (this.cache === undefined) {
      return undefined;
    }

    // A cacheTtlMs of 0 is infinite caching, so we can always return the
    // value.
    //
    // We also want to return it if the cache is still considered fresh.
    if (this._cacheTtlMs === 0 || this.cache.fresh(this._cacheTtlMs)) {
      return this.cache.value;
    }

    // If you have gotten this far, the cache is stale. Better to drop it as a
    // way to short-circuit checking the freshness again.
    this.cache = undefined;

    return undefined;
  }

  set(value: any): void {
    this.cache = new CacheItem(value);
  }
}
