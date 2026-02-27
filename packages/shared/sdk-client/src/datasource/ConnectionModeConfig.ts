import { isNullish, LDLogger, OptionMessages, TypeValidators } from '@launchdarkly/js-sdk-common';

import type { FDv2ConnectionMode, ModeDefinition } from '../api/datasource';
import validateOptions, { arrayOf, validatorOf } from '../configuration/validateOptions';

/**
 * A read-only mapping from each FDv2ConnectionMode to its ModeDefinition.
 */
type ModeTable = {
  readonly [K in FDv2ConnectionMode]: ModeDefinition;
};

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

const cacheEntryValidators = {
  type: dataSourceTypeValidator,
};

const pollingEntryValidators = {
  type: dataSourceTypeValidator,
  pollInterval: TypeValidators.numberWithMin(30),
  endpoints: validatorOf(endpointValidators),
};

const streamingEntryValidators = {
  type: dataSourceTypeValidator,
  initialReconnectDelay: TypeValidators.numberWithMin(1),
  endpoints: validatorOf(endpointValidators),
};

const dataSourceEntryArrayValidator = arrayOf(cacheEntryValidators, 'type', {
  cache: cacheEntryValidators,
  polling: pollingEntryValidators,
  streaming: streamingEntryValidators,
});

const modeDefinitionValidators = {
  initializers: dataSourceEntryArrayValidator,
  synchronizers: dataSourceEntryArrayValidator,
};

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

function isValidFDv2ConnectionMode(value: string): value is FDv2ConnectionMode {
  return connectionModeValidator.is(value);
}

function getFDv2ConnectionModeNames(): ReadonlyArray<FDv2ConnectionMode> {
  return Object.keys(MODE_TABLE) as FDv2ConnectionMode[];
}

function validateModeDefinition(
  input: unknown,
  name: string,
  logger?: LDLogger,
): ModeDefinition | undefined {
  if (isNullish(input) || !TypeValidators.Object.is(input)) {
    logger?.warn(OptionMessages.wrongOptionType(name, 'object', typeof input));
    return undefined;
  }

  return validateOptions(
    input as Record<string, unknown>,
    modeDefinitionValidators,
    { initializers: [], synchronizers: [] },
    logger,
    name,
  ) as unknown as ModeDefinition;
}

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
