interface CacheItem {
  value: any,
  expiration: number,
}

export default class Cache {
  _cache: CacheItem | undefined;

  constructor(private readonly _cacheTtlMs: number) {}

  get(): any | undefined {
    // If the cacheTtlMs is less than 0, the cache is disabled.
    if (this._cacheTtlMs < 0) {
      return undefined;
    }

    // If there isn't a cached item, we must return undefined.
    if (this._cache === undefined) {
      return undefined;
    }

    // A cacheTtlMs of 0 is infinite caching, so we can always return the
    // value.
    //
    // We also want to return the value if it hasn't expired.
    if (this._cacheTtlMs === 0 || Date.now() < this._cache.expiration) {
      return this._cache.value;
    }

    // If you have gotten this far, the cache is stale. Better to drop it as a
    // way to short-circuit checking the freshness again.
    this._cache = undefined;

    return undefined;
  }

  set(value: any): void {
    this._cache = {
      value: value,
      expiration: Date.now() + this._cacheTtlMs,
    }
  }
}
