function isStale(record: CacheRecord): boolean {
  return Date.now() > record.expiration;
}

/**
 * Check if a TTL value represents an infinite TTL.
 *
 * A negative TTL, or Infinity, means that cached items never expire.
 * @param ttl The TTL, in seconds, to check.
 * @returns True if the TTL is infinite.
 */
export function isInfiniteTtl(ttl: number): boolean {
  return ttl < 0 || ttl === Infinity;
}

/**
 * Options for the TTL cache.
 */
export interface TtlCacheOptions {
  /**
   * The TTL for all items in seconds. A negative value, or Infinity, means
   * that items never expire.
   */
  ttl: number;

  /**
   * Time, in seconds, to check for expired items and purge them from the cache.
   */
  checkInterval: number;
}

interface CacheRecord {
  value: any;
  expiration: number;
}

/**
 * A basic TTL cache with configurable TTL and check interval.
 */
export default class TtlCache {
  private _storage: Map<string, CacheRecord> = new Map();

  private _checkIntervalHandle: any;

  private _neverExpire: boolean;

  constructor(private readonly _options: TtlCacheOptions) {
    this._neverExpire = isInfiniteTtl(_options.ttl);
    // When items never expire there is nothing to purge.
    if (!this._neverExpire) {
      this._checkIntervalHandle = setInterval(() => {
        this._purgeStale();
      }, _options.checkInterval * 1000);
    }
  }

  /**
   * Get a value from the cache.
   * @param key The key to get a value for.
   * @returns The value for the key, or undefined if the key was not added, or
   * if the value has expired.
   */
  public get(key: string): any {
    const record = this._storage.get(key);
    if (record && isStale(record)) {
      this._storage.delete(key);
      return undefined;
    }
    return record?.value;
  }

  /**
   * Set an item in the cache. It will expire after the TTL specified
   * in the cache configuration. If the TTL is infinite, then the item
   * will not expire.
   * @param key The key for the value.
   * @param value The value to set.
   */
  public set(key: string, value: any) {
    this._storage.set(key, {
      value,
      expiration: this._neverExpire ? Infinity : Date.now() + this._options.ttl * 1000,
    });
  }

  /**
   * Delete the item with the specific key. If the item does not exist,
   * then there will be no change to the cache.
   * @param key The key of the value to delete.
   */
  public delete(key: string) {
    this._storage.delete(key);
  }

  /**
   * Clear the items that are in the cache.
   */
  public clear() {
    this._storage.clear();
  }

  /**
   * Indicate that you are no longer going to use the cache. The cache will be
   * cleared and it will stop checking for stale items.
   */
  public close() {
    this.clear();
    if (this._checkIntervalHandle) {
      clearInterval(this._checkIntervalHandle);
      this._checkIntervalHandle = null;
    }
  }

  private _purgeStale() {
    this._storage.forEach((record, key) => {
      if (isStale(record)) {
        this._storage.delete(key);
      }
    });
  }

  /**
   * This is for testing.
   * @internal
   */
  public get size() {
    return this._storage.size;
  }
}
