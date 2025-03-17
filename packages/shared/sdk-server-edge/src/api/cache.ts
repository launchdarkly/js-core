/**
 * General-purpose cache interface.
 *
 * This is used by the SDK to cache feature flags and other data. The SDK does
 * not assume any particular implementation of the cache, so you can provide
 * your own.
 */
export default interface Cache {
  /**
   * Get a value from the cache. Returning `undefined` means the key was not found.
   */
  get(key: string): any;

  /**
   * Set a value in the cache.
   */
  set(key: string, value: any): void;

  /**
   * The close method offers a way to clean up any resources used by the cache
   * on shutdown.
   */
  close(): void;
}
