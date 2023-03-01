/**
 * Represents a key-item pair. This is for use where associative data needs to
 * be represented as a list, such as maintaining the order of the items.
 */
export default interface KeyedItem<KeyType, ItemType> {
  key: KeyType;
  item: ItemType;
}
