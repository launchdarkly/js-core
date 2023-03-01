import { KeyedItems } from './KeyedItems';

/**
 * Used internally to describe a full set of environment data, which can include both feature
 * flags and user segments. The string key for each item is the `namespace` property of a
 * [[DataKind]].
 */
export type FullDataSet<T> = Record<string, KeyedItems<T>>;
