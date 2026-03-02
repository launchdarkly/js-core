import { DataSourceEntry } from './DataSourceEntry';

/**
 * Defines the data pipeline for a connection mode: which data sources
 * are used during initialization and which are used for ongoing synchronization.
 */
export interface ModeDefinition {
  /**
   * Ordered list of data sources to attempt during initialization.
   * Sources are tried in order; the first that successfully provides a full
   * data set transitions the SDK out of the initialization phase.
   */
  readonly initializers: ReadonlyArray<DataSourceEntry>;

  /**
   * Ordered list of data sources for ongoing synchronization after
   * initialization completes. Sources are in priority order with automatic
   * failover to the next source if the primary fails.
   * An empty array means no synchronization occurs (e.g., offline, one-shot).
   */
  readonly synchronizers: ReadonlyArray<DataSourceEntry>;
}
