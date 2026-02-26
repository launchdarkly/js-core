import FDv2ConnectionMode from './FDv2ConnectionMode';

/**
 * Base endpoint overrides that can be applied to any network data source entry.
 * Allows routing specific sources to different infrastructure (e.g., relay proxy fallback).
 */
interface EndpointConfig {
  /** Override for the polling base URI. */
  readonly pollingBaseUri?: string;
  /** Override for the streaming base URI. */
  readonly streamingBaseUri?: string;
}

/**
 * Configuration for a cache data source entry.
 */
interface CacheDataSourceEntry {
  readonly type: 'cache';
}

/**
 * Configuration for a polling data source entry.
 */
interface PollingDataSourceEntry {
  readonly type: 'polling';

  /** Override for the polling interval, in seconds. */
  readonly pollInterval?: number;

  /** Endpoint overrides for this polling source. */
  readonly endpoints?: EndpointConfig;
}

/**
 * Configuration for a streaming data source entry.
 */
interface StreamingDataSourceEntry {
  readonly type: 'streaming';

  /** Override for the initial reconnect delay, in seconds. */
  readonly initialReconnectDelay?: number;

  /** Endpoint overrides for this streaming source. */
  readonly endpoints?: EndpointConfig;
}

/**
 * A data source entry in a mode table. Each entry identifies a data source type
 * and carries type-specific configuration overrides.
 */
type DataSourceEntry = CacheDataSourceEntry | PollingDataSourceEntry | StreamingDataSourceEntry;

/**
 * Defines the data pipeline for a connection mode: which data sources
 * are used during initialization and which are used for ongoing synchronization.
 *
 * Spec reference: Req 5.3.1 — named connection modes with initializer/synchronizer lists.
 */
interface ModeDefinition {
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

/**
 * A read-only mapping from each FDv2ConnectionMode to its ModeDefinition.
 *
 * This is a mapped type over FDv2ConnectionMode, so TypeScript will produce
 * a compile error if a mode is added to the union but missing from the table.
 */
type ModeTable = {
  readonly [K in FDv2ConnectionMode]: ModeDefinition;
};

/**
 * The default polling interval for background mode, in seconds (1 hour).
 */
const BACKGROUND_POLL_INTERVAL_SECONDS = 3600;

/**
 * The built-in mode table defining initializer/synchronizer pipelines
 * for each FDv2 connection mode.
 *
 * When FDv2 becomes the default data system, this table drives the
 * CompositeDataSource construction for each mode.
 *
 * Spec references:
 * - Req 5.3.2: Built-in modes (streaming, polling, offline)
 * - Req 5.3.3: background mode for mobile (polling @ 1hr)
 * - Req 5.3.4: one-shot mode for browser
 */
const MODE_TABLE: ModeTable = {
  streaming: {
    initializers: [{ type: 'cache' }, { type: 'polling' }],
    synchronizers: [{ type: 'streaming' }, { type: 'polling' }],
  },
  polling: {
    initializers: [{ type: 'cache' }],
    synchronizers: [{ type: 'polling' }],
  },
  offline: {
    initializers: [{ type: 'cache' }],
    synchronizers: [],
  },
  'one-shot': {
    initializers: [{ type: 'cache' }, { type: 'polling' }, { type: 'streaming' }],
    synchronizers: [],
  },
  background: {
    initializers: [{ type: 'cache' }],
    synchronizers: [{ type: 'polling', pollInterval: BACKGROUND_POLL_INTERVAL_SECONDS }],
  },
};

/**
 * Returns the mode definition for the given FDv2 connection mode.
 */
function getModeDefinition(mode: FDv2ConnectionMode): ModeDefinition {
  return MODE_TABLE[mode];
}

/**
 * Returns true if the given string is a valid FDv2ConnectionMode.
 */
function isValidFDv2ConnectionMode(value: string): value is FDv2ConnectionMode {
  return value in MODE_TABLE;
}

/**
 * Returns the list of all valid FDv2 connection mode names.
 */
function getFDv2ConnectionModeNames(): ReadonlyArray<FDv2ConnectionMode> {
  return Object.keys(MODE_TABLE) as FDv2ConnectionMode[];
}

export type {
  CacheDataSourceEntry,
  PollingDataSourceEntry,
  StreamingDataSourceEntry,
  DataSourceEntry,
  EndpointConfig,
  ModeDefinition,
  ModeTable,
};
export {
  MODE_TABLE,
  BACKGROUND_POLL_INTERVAL_SECONDS,
  getModeDefinition,
  isValidFDv2ConnectionMode,
  getFDv2ConnectionModeNames,
};
