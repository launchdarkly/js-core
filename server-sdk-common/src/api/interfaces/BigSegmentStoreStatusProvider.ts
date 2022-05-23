import { BigSegmentStoreStatus } from './BigSegmentStoreStatus';

/**
 * An interface for querying the status of a Big Segment store.
 *
 * The Big Segment store is the component that receives information about Big Segments, normally
 * from a database populated by the LaunchDarkly Relay Proxy. Big Segments are a specific type of
 * user segments. For more information, read the LaunchDarkly documentation:
 * https://docs.launchdarkly.com/home/users/big-segments
 *
 * An implementation of this interface is returned by
 * {@link LDClient.bigSegmentStoreStatusProvider}. Application code never needs to implement this
 * interface.
 */
export interface BigSegmentStoreStatusProvider {
  /**
   * Gets the current status of the store, if known.
   *
   * @returns a {@link BigSegmentStoreStatus}, or `undefined` if the SDK has not yet queried the
   *   Big Segment store status
   */
  getStatus(): BigSegmentStoreStatus | undefined;

  /**
   * Gets the current status of the store, querying it if the status has not already been queried.
   *
   * @returns a Promise for the status of the store
   */
  requireStatus(): Promise<BigSegmentStoreStatus>;
}
