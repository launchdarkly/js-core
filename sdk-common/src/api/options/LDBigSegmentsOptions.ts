/**
 * Additional parameters for configuring the SDK's Big Segments behavior.
 *
 * Big Segments are a specific type of user segments. For more information, read the LaunchDarkly
 * documentation: https://docs.launchdarkly.com/home/users/big-segments
 *
 * @see {@link LDOptions.bigSegments}
 */
export interface LDBigSegmentsOptions {
  /**
   * Specifies the storage component that provides Big Segments data.
   *
   * This property is mandatory. It must be obtained from one of the SDK's database integrations,
   * such as https://github.com/launchdarkly/node-server-sdk-redis. You will normally specify a
   * database implementation that matches how the LaunchDarkly Relay Proxy is configured, since the
   * Relay Proxy manages the Big Segment data.
   */

  // TODO: This creates a cycle.
  // store: (options: LDOptions) => BigSegmentStore;

  /**
   * The maximum number of users whose Big Segment state will be cached by the SDK at any given
   * time.
   *
   * To reduce database traffic, the SDK maintains a least-recently-used cache by user key. When a
   * feature flag that references a Big Segment is evaluated for some user who is not currently in
   * the cache, the SDK queries the database for all Big Segment memberships of that user, and
   * stores them together in a single cache entry. If the cache is full, the oldest entry is
   * dropped.
   *
   * A higher value for `userCacheSize` means that database queries for Big Segments will be done
   * less often for recently-referenced users, if the application has many users, at the cost of
   * increased memory used by the cache.
   *
   * Cache entries can also expire based on the setting of {@link userCacheTime}.
   *
   * If not specified, the default value is 1000.
   */
  userCacheSize?: number;

  /**
   * The maximum length of time that the Big Segment state for a user will be cached by the SDK,
   * in seconds.
   *
   * See {@link userCacheSize} for more about this cache. A higher value for `userCacheTime` means
   * that database queries for the Big Segment state of any given user will be done less often, but
   * that changes to segment membership may not be detected as soon.
   *
   * If not specified, the default value is 5. Negative values are changed to the default.
   */
  userCacheTime?: number;

  /**
   * The interval at which the SDK will poll the Big Segment store to make sure it is available
   * and to determine how long ago it was updated, in seconds.
   *
   * If not specified, the default value is 5. Zero or negative values are changed to the default.
   */
  statusPollInterval?: number;

  /**
   * The maximum length of time between updates of the Big Segments data before the data is
   * considered out of date, in seconds.
   *
   * Normally, the LaunchDarkly Relay Proxy updates a timestamp in the Big Segment store at
   * intervals to confirm that it is still in sync with the LaunchDarkly data, even if there have
   * been no changes to the store.
   * If the timestamp falls behind the current time by the amount specified in `staleAfter`, the
   * SDK assumes that something is not working correctly in this process and that the data may not
   * be accurate.
   *
   * While in a stale state, the SDK will still continue using the last known data, but the status
   * from
   * {@link interfaces.BigSegmentStoreStatusProvider.getStatus} will have `stale: true`, and any
   * {@link LDEvaluationReason} generated from a feature flag that references a Big Segment will
   * have a `bigSegmentsStatus` of `"STALE"`.
   *
   * If not specified, the default value is 120 (two minutes). Zero or negative values are changed
   * to the default.
   */
  staleAfter?: number;
}
