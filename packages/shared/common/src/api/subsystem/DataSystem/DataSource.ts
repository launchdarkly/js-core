// TODO: refactor client-sdk to use this enum
export enum DataSourceState {
  // Positive confirmation of connection/data receipt
  Valid,
  // Spinning up to make first connection attempt
  Initializing,
  // Transient issue, automatic retry is expected
  Interrupted,
  // Data source was closed and will not retry
  Closed,
  // This datasource encountered an unrecoverable error and it is not expected to be resolved through trying again in the future
  Off,
}

// Matthew: include some designation with the Off status that indicates we should fall back to FDv1.
// Expand existing FDv1 polling source and add translation layer in that implementation.
// If FDv1 is also failing, then data system terminates/closes like it would if all FDv2 sources were failing.
// If any FDv2 source indicates to fall back to FDv1, drop all FDv2 sources.

// Resume here

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

export type LDDataSourceFactory = () => DataSource;
