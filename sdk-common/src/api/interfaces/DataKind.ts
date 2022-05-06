/**
 * Used internally to describe the type of data being queried or updated, such as feature flags or
 * user segments.
 *
 * This is the actual type of the `kind` parameter in `LDFeatureStore` methods. Those methods are
 * still declared as taking `any` for backward compatibility, but in the future they will reference
 * this type.
 */

export interface DataKind {
  /**
   * A string such as `"features"` or `"segments"` which can be used in keys to distinguish this
   * kind of data from other kinds.
   */
  namespace: string;
}
