import DataSourceStatusErrorInfo from './DataSourceStatusErrorInfo';

export enum DataSourceState {
  Initializing = 'INITIALIZING',
  Valid = 'VALID',
  Interrupted = 'INTERRUPTED',
  SetOffline = 'SET_OFFLINE',
  Closed = 'CLOSED',
  // TODO: SDK-702 - Implement network availability behaviors
  // NetworkUnavailable,
}

export default interface DataSourceStatus {
  /**
   * An enumerated value representing the overall current state of the data source.
   */
  readonly state: DataSourceState;

  /**
   * The UNIX epoch timestamp in milliseconds that the value of State most recently changed.
   *
   * The meaning of this depends on the current state:
   * For {@link DataSourceState.Initializing}, it is the time that the datasource started
   * attempting to retrieve data.
   *
   * For {@link DataSourceState.Valid}, it is the time that the data source most
   * recently entered a valid state, after previously having been
   * {@link DataSourceStatus.Initializing} or an invalid state such as
   * {@link DataSourceState.Interrupted}.
   *
   * - For {@link DataSourceState.interrupted}, it is the time that the data source
   * most recently entered an error state, after previously having been
   * {@link DataSourceState.valid}.
   *
   * For {@link DataSourceState.Closed}, it is the time that the data source
   * encountered an unrecoverable error or that the datasource was explicitly closed.
   */
  readonly stateSince: number;

  /**
   * The last error encountered. May be absent after application restart.
   */
  readonly lastError?: DataSourceStatusErrorInfo;
}
