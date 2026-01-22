import DataSourceStatusErrorInfo from './DataSourceStatusErrorInfo';

// TODO: SDK-702 - Implement network availability behaviors - add 'NETWORK_UNAVAILABLE' when implemented

/**
 * The initial state of the data source when the SDK is being
 * initialized.
 *
 * If it encounters an error that requires it to retry initialization,
 * the state will remain at Initializing until it either succeeds and
 * becomes {@link DataSourceValidState}, or permanently fails and becomes
 * {@link DataSourceClosedState}.
 */
export type DataSourceInitializingState = 'INITIALIZING';

/**
 * Indicates that the data source is currently operational and has not
 * had any problems since the last time it recieved data.
 *
 * In streaming mode, this means that there is currently an open stream
 * connection and that at least one initial message has been recieved on
 * the stream. In polling mode, this means that the last poll request
 * succeeded.
 */
export type DataSourceValidState = 'VALID';

/**
 * Indicates that the data source encountered an error that it will
 * attempt to recover from.
 *
 * In streaming mode, this means that the stream connection failed, or
 * had to be dropped due to some other error, and will be retried after
 * a backoff delay. In polling mode, it means that the last poll request
 * failed, and a new poll request will be made after the configured
 * polling interval.
 *
 * @remarks
 * Currently, support for this state is unreliable in the client-side SDKs
 * due to limitations with default EventSource implementations. We do not
 * recommend solely relying on this state for your application logic.
 */
export type DataSourceInterruptedState = 'INTERRUPTED';

/**
 * Indicates that the application has told the SDK to stay offline.
 */
export type DataSourceSetOfflineState = 'SET_OFFLINE';

/**
 * Indicates that the data source has been permanently closed.
 *
 * This could be because it encountered an unrecoverable error (for
 * instance, the LaunchDarkly service rejected the client key; an invalid
 * client key will never become valid), or because the SDK client was
 * explicitly shut down.
 */
export type DataSourceClosedState = 'CLOSED';

export type DataSourceState =
  | DataSourceInitializingState
  | DataSourceValidState
  | DataSourceInterruptedState
  | DataSourceSetOfflineState
  | DataSourceClosedState;

export default interface DataSourceStatus {
  /**
   * An enumerated value representing the overall current state of the data source.
   */
  readonly state: DataSourceState;

  /**
   * The UNIX epoch timestamp in milliseconds that the value of State most recently changed.
   *
   * The meaning of this depends on the current state:
   * For 'INITIALIZING', it is the time that the datasource started
   * attempting to retrieve data.
   *
   * For 'VALID', it is the time that the data source most
   * recently entered a valid state, after previously having been
   * 'INITIALIZING' or an invalid state such as
   * 'INTERRUPTED'.
   *
   * - For 'INTERRUPTED', it is the time that the data source
   * most recently entered an error state, after previously having been
   * 'VALID'.
   *
   * For 'CLOSED', it is the time that the data source
   * encountered an unrecoverable error or that the datasource was explicitly closed.
   */
  readonly stateSince: number;

  /**
   * The last error encountered. May be absent after application restart.
   */
  readonly lastError?: DataSourceStatusErrorInfo;
}

// This is a temporary compat for react native. We should remove this once we
// major version react native SDK.
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const DataSourceState: {
  readonly Initializing: 'INITIALIZING';
  readonly Valid: 'VALID';
  readonly Interrupted: 'INTERRUPTED';
  readonly SetOffline: 'SET_OFFLINE';
  readonly Closed: 'CLOSED';
} = {
  Initializing: 'INITIALIZING',
  Valid: 'VALID',
  Interrupted: 'INTERRUPTED',
  SetOffline: 'SET_OFFLINE',
  Closed: 'CLOSED',
};
