// TODO: refactor client-sdk to use this enum
export enum DataSourceState {
  // Spinning up to make first connection attempt
  Initializing,
  // Positive confirmation of connection/data receipt
  Valid,
  // Transient issue, automatic retry is expected
  Interrupted,
  // Permanent issue, external intervention required
  Closed,
}

export interface DataSource {
  /**
   * May be called any number of times, if already started, has no effect
   * @param dataCallback that will be called when data arrives, may be called multiple times.
   * @param statusCallback that will be called when data source state changes or an unrecoverable error
   * has been encountered.
   */
  start(
    dataCallback: (basis: boolean, data: any) => void,
    statusCallback: (status: DataSourceState, err?: any) => void,
  ): void;

  /**
   * May be called any number of times, if already stopped, has no effect.
   */
  stop(): void;
}

export type LDInitializerFactory = () => DataSystemInitializer;

export type LDSynchronizerFactory = () => DataSystemSynchronizer;

/**
 * A data source that can be used to fetch the basis.
 */
export interface DataSystemInitializer extends DataSource {}

/**
 * A data source that can be used to fetch the basis or ongoing data changes.
 */
export interface DataSystemSynchronizer extends DataSource {}
