// TODO: refactor client-sdk to use this enum
export enum DataSourceState {
  // Positive confirmation of connection/data receipt
  Valid,
  // Spinning up to make first connection attempt
  Initializing,
  // Transient issue, automatic retry is expected
  Interrupted,
  // Data source was closed and will not retry automatically.
  Closed,
}

export interface DataSource {
  /**
   * May be called any number of times, if already started, has no effect
   * @param dataCallback that will be called when data arrives, may be called multiple times.
   * @param statusCallback that will be called when data source state changes or an unrecoverable error
   * has been encountered.
   * @param selectorGetter that can be invoked to provide the FDv2 selector/basis if one exists
   */
  start(
    dataCallback: (basis: boolean, data: any) => void,
    statusCallback: (status: DataSourceState, err?: any) => void,
    selectorGetter?: () => string | undefined,
  ): void;

  /**
   * May be called any number of times, if already stopped, has no effect.
   */
  stop(): void;
}

export type LDDataSourceFactory = () => DataSource;
