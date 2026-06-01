/**
 * Interface for providing a custom storage implementation to a client-side SDK.
 *
 * This interface should only be used when customizing the storage mechanism
 * used by the SDK. Typical usage of the SDK does not require implementing this
 * interface.
 *
 * Storage is used to cache flag values per context and to persist generated
 * identifiers. It may be used for additional features in the future.
 *
 * Implementations should not throw exceptions. If an implementation does throw,
 * the SDK guards against it: the error is logged and the operation degrades
 * gracefully (reads return `null`, writes are dropped) rather than crashing the
 * host application.
 */
export interface LDStorage {
  /**
   * Get a value from the storage.
   *
   * @param key The key to get a value for.
   * @returns A promise which resolves to the value for the specified key, or
   * null if there is no value for the key.
   */
  get: (key: string) => Promise<string | null>;

  /**
   * Set the given key to the specified value.
   *
   * @param key The key to set a value for.
   * @param value The value to set for the key.
   * @returns A promise that resolves after the operation completes.
   */
  set: (key: string, value: string) => Promise<void>;

  /**
   * Clear the value associated with a given key.
   *
   * After clearing a key subsequent calls to the get function should return
   * null for that key.
   *
   * @param key The key to clear the value for.
   * @returns A promise that resolves after that operation completes.
   */
  clear: (key: string) => Promise<void>;
}
