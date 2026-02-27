import { isNullish, LDLogger, OptionMessages, TypeValidators } from '@launchdarkly/js-sdk-common';

import type { DataSourceEntry, FDv2ConnectionMode, ModeDefinition } from '../api/datasource';
import validateOptions from '../configuration/validateOptions';

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

const dataSourceTypeValidator = TypeValidators.oneOf('cache', 'polling', 'streaming');
const connectionModeValidator = TypeValidators.oneOf(
  'streaming',
  'polling',
  'offline',
  'one-shot',
  'background',
);

const endpointValidators = {
  pollingBaseUri: TypeValidators.String,
  streamingBaseUri: TypeValidators.String,
};

const pollingEntryValidators = {
  type: dataSourceTypeValidator,
  pollInterval: TypeValidators.numberWithMin(30),
  endpoints: TypeValidators.Object,
};

const streamingEntryValidators = {
  type: dataSourceTypeValidator,
  initialReconnectDelay: TypeValidators.numberWithMin(1),
  endpoints: TypeValidators.Object,
};

const cacheEntryValidators = {
  type: dataSourceTypeValidator,
};

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
  return connectionModeValidator.is(value);
}

/**
 * Returns the list of all valid FDv2 connection mode names.
 */
function getFDv2ConnectionModeNames(): ReadonlyArray<FDv2ConnectionMode> {
  return Object.keys(MODE_TABLE) as FDv2ConnectionMode[];
}

// ----------------------------- Validation --------------------------------

function validateDataSourceEntry(
  entry: unknown,
  path: string,
  logger?: LDLogger,
): DataSourceEntry | undefined {
  if (isNullish(entry) || !TypeValidators.Object.is(entry)) {
    logger?.warn(OptionMessages.wrongOptionType(path, 'object', typeof entry));
    return undefined;
  }

  const obj = entry as Record<string, unknown>;

  if (!dataSourceTypeValidator.is(obj.type)) {
    const received = typeof obj.type === 'string' ? (obj.type as string) : typeof obj.type;
    logger?.warn(
      OptionMessages.wrongOptionType(`${path}.type`, dataSourceTypeValidator.getType(), received),
    );
    return undefined;
  }

  let entryValidators = cacheEntryValidators;
  if (obj.type === 'polling') {
    entryValidators = pollingEntryValidators;
  } else if (obj.type === 'streaming') {
    entryValidators = streamingEntryValidators;
  }

  const validated = validateOptions(obj, entryValidators, { type: obj.type }, logger, path);

  // Validate nested endpoints if present
  if (TypeValidators.Object.is(validated.endpoints)) {
    const ep = validateOptions(
      validated.endpoints as Record<string, unknown>,
      endpointValidators,
      {},
      logger,
      `${path}.endpoints`,
    );
    if (Object.keys(ep).length > 0) {
      validated.endpoints = ep;
    } else {
      delete validated.endpoints;
    }
  }

  return validated as unknown as DataSourceEntry;
}

function validateDataSourceEntryList(
  list: unknown,
  path: string,
  logger?: LDLogger,
): DataSourceEntry[] {
  if (isNullish(list)) {
    return [];
  }

  if (!Array.isArray(list)) {
    logger?.warn(OptionMessages.wrongOptionType(path, 'array', typeof list));
    return [];
  }

  return list
    .map((item, i) => validateDataSourceEntry(item, `${path}[${i}]`, logger))
    .filter((item): item is DataSourceEntry => item !== undefined);
}

/**
 * Validates a user-provided ModeDefinition. Invalid data source entries
 * are discarded.
 */
function validateModeDefinition(
  input: unknown,
  name: string,
  logger?: LDLogger,
): ModeDefinition | undefined {
  if (isNullish(input) || !TypeValidators.Object.is(input)) {
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
 */
function validateModeTable(
  input: unknown,
  defaults: ModeTable = MODE_TABLE,
  logger?: LDLogger,
): ModeTable {
  if (isNullish(input)) {
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
        OptionMessages.wrongOptionType('connectionModes', connectionModeValidator.getType(), key),
      );
      return;
    }

    const validated = validateModeDefinition(obj[key], `connectionModes.${key}`, logger);
    if (validated) {
      result[key] = validated;
    }
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
