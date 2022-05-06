/**
 * Used internally to describe a set of stored data items of the same kind, such as feature flags
 * or user segments. The string key for each item is the same as the item's `key` property.
 */
export type KeyedItems<T> = Record<string, T>;
