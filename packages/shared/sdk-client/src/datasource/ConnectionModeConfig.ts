import { LDLogger } from '@launchdarkly/js-sdk-common';

import FDv2ConnectionMode from './FDv2ConnectionMode';

/**
 * Endpoint overrides for a network data source entry. Allows routing specific
 * sources to different infrastructure (e.g., a relay proxy as a fallback).
 *
 * When not specified, the SDK uses `baseUri` for polling and `streamUri` for
 * streaming from the base SDK configuration.
 */
interface EndpointConfig {
  /** Override for the polling base URI. Defaults to `baseUri` from SDK configuration. */
  readonly pollingBaseUri?: string;
  /** Override for the streaming base URI. Defaults to `streamUri` from SDK configuration. */
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

const VALID_DATA_SOURCE_TYPES = new Set(['cache', 'polling', 'streaming']);

/**
 * The built-in mode table defining initializer/synchronizer pipelines
 * for each FDv2 connection mode.
 *
 * When FDv2 becomes the default data system, this table drives the
 * CompositeDataSource construction for each mode.
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

// ----------------------------- Validation --------------------------------

function validateEndpointConfig(
  endpoints: unknown,
  path: string,
  logger?: LDLogger,
): EndpointConfig | undefined {
  if (endpoints === undefined || endpoints === null) {
    return undefined;
  }

  if (typeof endpoints !== 'object') {
    logger?.warn(
      `Config option "${path}.endpoints" should be of type object, got ${typeof endpoints}, discarding`,
    );
    return undefined;
  }

  const result: { pollingBaseUri?: string; streamingBaseUri?: string } = {};
  const obj = endpoints as Record<string, unknown>;

  if (obj.pollingBaseUri !== undefined && obj.pollingBaseUri !== null) {
    if (typeof obj.pollingBaseUri === 'string') {
      result.pollingBaseUri = obj.pollingBaseUri;
    } else {
      logger?.warn(
        `Config option "${path}.endpoints.pollingBaseUri" should be of type string, got ${typeof obj.pollingBaseUri}, discarding`,
      );
    }
  }

  if (obj.streamingBaseUri !== undefined && obj.streamingBaseUri !== null) {
    if (typeof obj.streamingBaseUri === 'string') {
      result.streamingBaseUri = obj.streamingBaseUri;
    } else {
      logger?.warn(
        `Config option "${path}.endpoints.streamingBaseUri" should be of type string, got ${typeof obj.streamingBaseUri}, discarding`,
      );
    }
  }

  if (result.pollingBaseUri === undefined && result.streamingBaseUri === undefined) {
    return undefined;
  }

  return result;
}

function validateDataSourceEntry(
  entry: unknown,
  path: string,
  logger?: LDLogger,
): DataSourceEntry | undefined {
  if (entry === undefined || entry === null || typeof entry !== 'object') {
    logger?.warn(
      `Config option "${path}" should be of type object, got ${typeof entry}, discarding entry`,
    );
    return undefined;
  }

  const obj = entry as Record<string, unknown>;

  if (typeof obj.type !== 'string') {
    logger?.warn(
      `Config option "${path}.type" should be of type string, got ${typeof obj.type}, discarding entry`,
    );
    return undefined;
  }

  if (!VALID_DATA_SOURCE_TYPES.has(obj.type)) {
    logger?.warn(
      `Config option "${path}.type" has unknown value "${obj.type}", must be one of: cache, polling, streaming. Discarding entry`,
    );
    return undefined;
  }

  if (obj.type === 'cache') {
    return { type: 'cache' };
  }

  if (obj.type === 'polling') {
    const result: { type: 'polling'; pollInterval?: number; endpoints?: EndpointConfig } = {
      type: 'polling',
    };

    if (obj.pollInterval !== undefined && obj.pollInterval !== null) {
      if (typeof obj.pollInterval === 'number' && obj.pollInterval > 0) {
        result.pollInterval = obj.pollInterval;
      } else {
        logger?.warn(
          `Config option "${path}.pollInterval" should be a positive number, got ${JSON.stringify(obj.pollInterval)}, using default`,
        );
      }
    }

    const endpoints = validateEndpointConfig(obj.endpoints, path, logger);
    if (endpoints) {
      result.endpoints = endpoints;
    }

    return result;
  }

  // streaming
  const result: {
    type: 'streaming';
    initialReconnectDelay?: number;
    endpoints?: EndpointConfig;
  } = { type: 'streaming' };

  if (obj.initialReconnectDelay !== undefined && obj.initialReconnectDelay !== null) {
    if (typeof obj.initialReconnectDelay === 'number' && obj.initialReconnectDelay > 0) {
      result.initialReconnectDelay = obj.initialReconnectDelay;
    } else {
      logger?.warn(
        `Config option "${path}.initialReconnectDelay" should be a positive number, got ${JSON.stringify(obj.initialReconnectDelay)}, using default`,
      );
    }
  }

  const endpoints = validateEndpointConfig(obj.endpoints, path, logger);
  if (endpoints) {
    result.endpoints = endpoints;
  }

  return result;
}

function validateDataSourceEntryList(
  list: unknown,
  path: string,
  logger?: LDLogger,
): DataSourceEntry[] {
  if (list === undefined || list === null) {
    return [];
  }

  if (!Array.isArray(list)) {
    logger?.warn(
      `Config option "${path}" should be of type array, got ${typeof list}, using empty list`,
    );
    return [];
  }

  const result: DataSourceEntry[] = [];
  for (let i = 0; i < list.length; i++) {
    const validated = validateDataSourceEntry(list[i], `${path}[${i}]`, logger);
    if (validated) {
      result.push(validated);
    }
  }
  return result;
}

/**
 * Validates a user-provided ModeDefinition, logging warnings for any invalid
 * values and replacing them with safe defaults. Invalid data source entries
 * are discarded.
 *
 * This is intended for validating user-provided configuration. The built-in
 * MODE_TABLE does not need validation.
 *
 * @param input The unvalidated mode definition (may have incorrect types).
 * @param name A descriptive name for the mode, used in warning messages.
 * @param logger Logger for validation warnings.
 * @returns A validated ModeDefinition with only valid entries.
 */
function validateModeDefinition(
  input: unknown,
  name: string,
  logger?: LDLogger,
): ModeDefinition | undefined {
  if (input === undefined || input === null || typeof input !== 'object') {
    logger?.warn(
      `Config option "${name}" should be of type object, got ${typeof input}, using default value`,
    );
    return undefined;
  }

  const obj = input as Record<string, unknown>;

  return {
    initializers: validateDataSourceEntryList(obj.initializers, `${name}.initializers`, logger),
    synchronizers: validateDataSourceEntryList(obj.synchronizers, `${name}.synchronizers`, logger),
  };
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
  validateModeDefinition,
};
