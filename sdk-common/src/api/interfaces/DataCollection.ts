import { DataKind } from "./DataKind";

/**
 * Used internally for data store implementations that require items in an ordered list rather
 * than as object properties.
 */


export interface DataCollection<T> {
  /**
   * Describes the kind of items, such as feature flags or user segments.
   */
  kind: DataKind;

  /**
   * An ordered list of items of this kind.
   */
  items: Array<T>;
}
