/**
 * A versioned item (or placeholder). Used for interoperability between persistent stores and the
 * SDK. The persistent store should generally operate on {@link SerializedItemDescriptor}s, but
 * aside from a special case described in {@link PersistentDataStore}.
 */
export default interface ItemDescriptor {
  /**
   * The version of the data, provided by the SDK.
   */
  readonly version: number;

  /**
   * The data item, or null is this is a placeholder.
   */
  readonly item: any;
}
