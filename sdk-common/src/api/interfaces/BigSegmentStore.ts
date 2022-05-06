import { BigSegmentStoreMembership } from './BigSegmentStoreMembership';
import { BigSegmentStoreMetadata } from './BigSegmentStoreMetadata';

/**
 * A read-only data store that allows querying of user membership in Big Segments.
 *
 * Big Segments are a specific type of user segments. For more information, read the LaunchDarkly
 * documentation: https://docs.launchdarkly.com/home/users/big-segments
 */

export interface BigSegmentStore {
  /**
   * Queries information about the overall state of the store.
   *
   * The resolved value of the Promise should always be a [[BigSegmentStoreMetadata]] object. If
   * the store is accessible but contains no metadata, the object's `lastUpToDate` property can be
   * undefined. If the store is not accessible due to a database error, the method can throw an
   * exception/reject the promise.
   *
   * This method will be called only when the SDK needs the latest state, so it should not be cached.
   *
   * @returns a Promise for the result of the query
   */
  getMetadata(): Promise<BigSegmentStoreMetadata>;

  /**
   * Queries the store for a snapshot of the current segment state for a specific user.
   *
   * The userHash is a base64-encoded string produced by hashing the user key as defined by
   * the Big Segments specification; the store implementation does not need to know the details
   * of how this is done, because it deals only with already-hashed keys, but the string can be
   * assumed to only contain characters that are valid in base64.
   *
   * The resolved value of the Promise should be either a [[BigSegmentStoreMembership]], or
   * undefined if the user is not referenced in any Big Segments (this is equivalent to a
   * [[BigSegmentStoreMembership]] that has no properties).
   *
   * @param userHash identifies the user
   * @returns a Promise for the result of the query.
   */
  getUserMembership(userHash: string): Promise<BigSegmentStoreMembership | undefined>;

  /**
   * Releases any resources being used by the store.
   */
  close(): void;
}
