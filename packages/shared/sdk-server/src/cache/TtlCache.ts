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
  private storage: Map<string, CacheRecord> = new Map();

  private checkIntervalHandle: any;

  constructor(private readonly options: TtlCacheOptions) {
    this.checkIntervalHandle = setInterval(() => {
      this.purgeStale();
    }, options.checkInterval * 1000);
  }

  /**
   * Get a value from the cache.
   * @param key The key to get a value for.
   * @returns The value for the key, or undefined if the key was not added, or
   * if the value has expired.
   */
  public get(key: string): any {
    const record = this.storage.get(key);
    if (record && isStale(record)) {
      this.storage.delete(key);
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
    this.storage.set(key, {
      value,
      expiration: Date.now() + this.options.ttl * 1000,
    });
  }

  /**
   * Delete the item with the specific key. If the item does not exist,
   * then there will be no change to the cache.
   * @param key The key of the value to delete.
   */
  public delete(key: string) {
    this.storage.delete(key);
  }

  /**
   * Clear the items that are in the cache.
   */
  public clear() {
    this.storage.clear();
  }

  /**
   * Indicate that you are no longer going to use the cache. The cache will be
   * cleared and it will stop checking for stale items.
   */
  public close() {
    this.clear();
    if (this.checkIntervalHandle) {
      clearInterval(this.checkIntervalHandle);
      this.checkIntervalHandle = null;
    }
  }

  private purgeStale() {
    this.storage.forEach((record, key) => {
      if (isStale(record)) {
        this.storage.delete(key);
      }
    });
  }

  /**
   * This is for testing.
   * @internal
   */
  public get size() {
    return this.storage.size;
  }
}
