import { LDLogger, OptionMessages, TypeValidators } from '@launchdarkly/js-sdk-common';

import type {
  DataSourceEntry,
  EndpointConfig,
  FDv2ConnectionMode,
  ModeDefinition,
} from '../api/datasource';

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
const positiveNumber = TypeValidators.numberWithMin(1);

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

  if (!TypeValidators.Object.is(endpoints)) {
    logger?.warn(
      OptionMessages.wrongOptionType(`${path}.endpoints`, 'object', typeof endpoints),
    );
    return undefined;
  }

  const result: { pollingBaseUri?: string; streamingBaseUri?: string } = {};
  const obj = endpoints as Record<string, unknown>;

  if (obj.pollingBaseUri !== undefined && obj.pollingBaseUri !== null) {
    if (TypeValidators.String.is(obj.pollingBaseUri)) {
      result.pollingBaseUri = obj.pollingBaseUri;
    } else {
      logger?.warn(
        OptionMessages.wrongOptionType(
          `${path}.endpoints.pollingBaseUri`,
          'string',
          typeof obj.pollingBaseUri,
        ),
      );
    }
  }

  if (obj.streamingBaseUri !== undefined && obj.streamingBaseUri !== null) {
    if (TypeValidators.String.is(obj.streamingBaseUri)) {
      result.streamingBaseUri = obj.streamingBaseUri;
    } else {
      logger?.warn(
        OptionMessages.wrongOptionType(
          `${path}.endpoints.streamingBaseUri`,
          'string',
          typeof obj.streamingBaseUri,
        ),
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
  if (entry === undefined || entry === null || !TypeValidators.Object.is(entry)) {
    logger?.warn(OptionMessages.wrongOptionType(path, 'object', typeof entry));
    return undefined;
  }

  const obj = entry as Record<string, unknown>;

  if (!TypeValidators.String.is(obj.type)) {
    logger?.warn(OptionMessages.wrongOptionType(`${path}.type`, 'string', typeof obj.type));
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
      if (positiveNumber.is(obj.pollInterval)) {
        result.pollInterval = obj.pollInterval;
      } else {
        logger?.warn(
          OptionMessages.wrongOptionType(
            `${path}.pollInterval`,
            'positive number',
            JSON.stringify(obj.pollInterval),
          ),
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
    if (positiveNumber.is(obj.initialReconnectDelay)) {
      result.initialReconnectDelay = obj.initialReconnectDelay;
    } else {
      logger?.warn(
        OptionMessages.wrongOptionType(
          `${path}.initialReconnectDelay`,
          'positive number',
          JSON.stringify(obj.initialReconnectDelay),
        ),
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
    logger?.warn(OptionMessages.wrongOptionType(path, 'array', typeof list));
    return [];
  }

  const result: DataSourceEntry[] = [];
  for (let i = 0; i < list.length; i += 1) {
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
  if (input === undefined || input === null || !TypeValidators.Object.is(input)) {
    logger?.warn(OptionMessages.wrongOptionType(name, 'object', typeof input));
    return undefined;
  }

  const obj = input as Record<string, unknown>;

  return {
    initializers: validateDataSourceEntryList(obj.initializers, `${name}.initializers`, logger),
    synchronizers: validateDataSourceEntryList(obj.synchronizers, `${name}.synchronizers`, logger),
  };
}

/**
 * Validates a user-provided mode table and merges it with defaults.
 * User overrides replace the default definition for a given mode;
 * modes not present in the input retain their defaults.
 *
 * Unknown mode names (not in FDv2ConnectionMode) are logged as warnings and
 * discarded. Invalid mode definitions within known modes are also logged and
 * the default for that mode is kept.
 *
 * @param input The unvalidated partial mode table (may have incorrect types).
 * @param defaults The base mode table to merge user overrides into. Platform SDKs
 *   can pass a customized base table; defaults to the built-in MODE_TABLE.
 * @param logger Logger for validation warnings.
 * @returns A complete ModeTable with validated user overrides merged over defaults.
 */
function validateModeTable(
  input: unknown,
  defaults: ModeTable = MODE_TABLE,
  logger?: LDLogger,
): ModeTable {
  if (input === undefined || input === null) {
    return defaults;
  }

  if (!TypeValidators.Object.is(input)) {
    logger?.warn(OptionMessages.wrongOptionType('connectionModes', 'object', typeof input));
    return defaults;
  }

  const obj = input as Record<string, unknown>;
  const result = { ...defaults } as { [K in FDv2ConnectionMode]: ModeDefinition };

  Object.keys(obj).forEach((key) => {
    if (!isValidFDv2ConnectionMode(key)) {
      logger?.warn(
        `Config option "connectionModes" has unknown mode "${key}", must be one of: ${getFDv2ConnectionModeNames().join(', ')}. Discarding`,
      );
      return;
    }

    const validated = validateModeDefinition(obj[key], `connectionModes.${key}`, logger);
    if (validated) {
      result[key] = validated;
    }
    // If validation returns undefined, the default for this mode is kept.
  });

  return result;
}

export type { ModeTable };
export {
  MODE_TABLE,
  BACKGROUND_POLL_INTERVAL_SECONDS,
  isValidFDv2ConnectionMode,
  getFDv2ConnectionModeNames,
  validateModeDefinition,
  validateModeTable,
};
