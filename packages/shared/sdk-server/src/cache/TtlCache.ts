function isStale(record: CacheRecord): boolean {
  return Date.now() > record.expiration;
}

/**
 * Options for the TTL cache.
 *
 * @internal
 */
export interface TtlCacheOptions {
  /**
   * The TTL for all items in seconds.
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
 *
 * @internal
 */
export default class TtlCache {
  private _storage: Map<string, CacheRecord> = new Map();

  private _checkIntervalHandle: any;

  constructor(private readonly _options: TtlCacheOptions) {
    this._checkIntervalHandle = setInterval(() => {
      this._purgeStale();
    }, _options.checkInterval * 1000);
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
   * in the cache configuration.
   * @param key The key for the value.
   * @param value The value to set.
   */
  public set(key: string, value: any) {
    this._storage.set(key, {
      value,
      expiration: Date.now() + this._options.ttl * 1000,
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
