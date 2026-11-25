/**
 * The result of reading cached flag values for a context.
 */
export interface LDCacheLookupResult {
  /**
   * True when the SDK loaded cached flag values. False when there were no cached values, when the
   * cache is disabled or unavailable, and when the identify operation did not read the cache. Some
   * SDKs do not read the cache when identify is given bootstrap data.
   */
  hit: boolean;
}
