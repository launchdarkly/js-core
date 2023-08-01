import { EventEmitter } from 'events';

import { interfaces } from '@launchdarkly/js-server-sdk-common';

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
 *
 * Note that this type inherits from `EventEmitter`, so you can use the standard `on()`, `once()`,
 * and `off()` methods to receive status change events. The standard `EventEmitter` methods are not
 * documented here; see the
 * {@link https://nodejs.org/api/events.html#events_class_eventemitter|Node API documentation}. The
 * type of the status change event is `"change"`, and its value is the same value that would be
 * returned by {@link getStatus}.
 */
export interface BigSegmentStoreStatusProvider extends EventEmitter {
  /**
   * Gets the current status of the store, if known.
   *
   * @returns status information, or `undefined` if the SDK has not yet queried the
   *   Big Segment store status
   */
  getStatus(): interfaces.BigSegmentStoreStatus | undefined;

  /**
   * Gets the current status of the store, querying it if the status has not already been queried.
   *
   * @returns a Promise for the status of the store
   */
  requireStatus(): Promise<interfaces.BigSegmentStoreStatus>;
}
