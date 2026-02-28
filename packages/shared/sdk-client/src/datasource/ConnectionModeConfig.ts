import { TypeValidators } from '@launchdarkly/js-sdk-common';

import type { FDv2ConnectionMode, ModeDefinition } from '../api/datasource';
import { arrayOf, recordOf, validatorOf } from '../configuration/validateOptions';

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

const dataSourceEntryArrayValidator = arrayOf('type', {
  cache: cacheEntryValidators,
  polling: pollingEntryValidators,
  streaming: streamingEntryValidators,
});

const modeDefinitionValidators = {
  initializers: dataSourceEntryArrayValidator,
  synchronizers: dataSourceEntryArrayValidator,
};

const MODE_DEFINITION_DEFAULTS: Record<string, unknown> = {
  initializers: [],
  synchronizers: [],
};

const connectionModesValidator = recordOf(
  connectionModeValidator,
  validatorOf(modeDefinitionValidators),
);

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

export type { ModeTable };
export {
  MODE_TABLE,
  MODE_DEFINITION_DEFAULTS,
  BACKGROUND_POLL_INTERVAL_SECONDS,
  connectionModeValidator,
  modeDefinitionValidators,
  connectionModesValidator,
  isValidFDv2ConnectionMode,
  getFDv2ConnectionModeNames,
};
