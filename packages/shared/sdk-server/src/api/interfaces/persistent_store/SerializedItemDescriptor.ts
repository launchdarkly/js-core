/**
 * A versioned item (or placeholder) storable in a [PersistentDataStore].
 */
export default interface SerializedItemDescriptor {
  /**
   * The version of the data.
   */
  readonly version: number;

  /**
   * True if this a placeholder (tombstone) for a deleted item.
   *
   * If so, {@link #serializedItem} will still contain a string representing the deleted item, but
   * the persistent store implementation has the option of not storing it if it can represent the
   * placeholder in a more efficient way.
   */
  readonly deleted?: boolean;

  /**
   * Returns the data item's serialized representation. This will never be null when storing an
   * item; for a deleted item placeholder, it will contain a special value that can be stored if
   * necessary. When reading an item from a store this could be null.
   * (see {@link #deleted()}).
   */
  readonly serializedItem?: string;
}
