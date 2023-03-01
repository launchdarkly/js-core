/**
 * Used internally to describe the basic properties of stored data such as feature flags or user
 * segments.
 *
 * This is the actual type of parameters and return values in `LDFeatureStore` methods that refer
 * to a flag or segment item. Those methods still use the `object` type for backward compatibility.
 */
export interface VersionedData {
  /**
   * The item's unique key, such as a feature flag key.
   */
  key: string;

  /**
   * A version number that LaunchDarkly will increment each time this item is changed.
   */
  version: number;

  /**
   * True if this is a deleted item placeholder (tombstone).
   */
  deleted?: boolean;
}
