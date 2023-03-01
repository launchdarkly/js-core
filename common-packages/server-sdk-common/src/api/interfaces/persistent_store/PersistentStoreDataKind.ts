import ItemDescriptor from './ItemDescriptor';

/**
 * Represents a separately namespaced collection of storable data items.
 * The SDK passes instances of this type to the persistent data store to specify whether it is
 * referring to a feature flag, a user segment, etc. The data store implementation should not look
 * for a specific data kind (such as feature flags), but should treat all data kinds generically.
 */
export default interface PersistentStoreDataKind {
  readonly namespace: string;

  /**
   * Creates an item of this kind from its serialized representation.
   *
   * The SDK uses this function to translate data that is returned by a {@link PersistentDataStore}.
   * Store implementations do not normally need to call it, but there is a special case described in
   * the documentation for {@link PersistentDataStore}, regarding updates.
   *
   * The returned {@link ItemDescriptor} has two properties: {@link ItemDescriptor#item}, which
   * is the deserialized object or a `null` value for a deleted item placeholder, and
   * {@link ItemDescriptor#version}, which provides the object's version number regardless of
   * whether it is deleted or not.
   *
   * @param data the serialized representation
   * @return an {@link ItemDescriptor} describing the deserialized object or null if the item could
   * not be deserialized
   */
  deserialize(data: string): ItemDescriptor | undefined;
}
