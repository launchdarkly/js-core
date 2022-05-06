/**
 * Values returned by BigSegmentStore.getMetadata().
 */

export interface BigSegmentStoreMetadata {
  /**
   * The Unix epoch millisecond timestamp of the last update to the BigSegmentStore. It is
   * undefined if the store has never been updated.
   */
  lastUpToDate?: number;
}
