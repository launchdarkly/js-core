import { LDClient as LDClientCommon } from '@launchdarkly/js-server-sdk-common';
import { BigSegmentStoreStatusProvider } from './interfaces';


/**
 * The LaunchDarkly SDK client object.
 *
 * Create this object with [[init]]. Applications should configure the client at startup time and
 * continue to use it throughout the lifetime of the application, rather than creating instances on
 * the fly.
 *
 */
export interface LDClient extends LDClientCommon {
  /**
   * A mechanism for tracking the status of a Big Segment store.
   *
   * This object has methods for checking whether the Big Segment store is (as far as the SDK
   * knows) currently operational and tracking changes in this status. See
   * {@link interfaces.BigSegmentStoreStatusProvider} for more about this functionality.
   */
  readonly bigSegmentStoreStatusProvider: BigSegmentStoreStatusProvider;
}
