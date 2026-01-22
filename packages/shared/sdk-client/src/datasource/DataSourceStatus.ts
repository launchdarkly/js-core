import DataSourceStatusErrorInfo from './DataSourceStatusErrorInfo';

// TODO: SDK-702 - Implement network availability behaviors - add 'NETWORK_UNAVAILABLE' when implemented
export type DataSourceState = 'INITIALIZING' | 'VALID' | 'INTERRUPTED' | 'SET_OFFLINE' | 'CLOSED';

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
