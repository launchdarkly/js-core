// TODO: refactor client-sdk to use this enum
/**
 * @experimental
 * This feature is not stable and not subject to any backwards compatibility guarantees or semantic
 * versioning.  It is not suitable for production usage.
 */
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

/**
 * @experimental
 * This feature is not stable and not subject to any backwards compatibility guarantees or semantic
 * versioning.  It is not suitable for production usage.
 */
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
   * May be called any number of times, if already stopped, has no effect. Datasource will not make any additional callbacks after stop returns.
   */
  stop(): void;
}

/**
 * @experimental
 * This feature is not stable and not subject to any backwards compatibility guarantees or semantic
 * versioning.  It is not suitable for production usage.
 */
export type LDDataSourceFactory = () => DataSource;
