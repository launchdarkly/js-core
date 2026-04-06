import { TypeValidators } from '@launchdarkly/js-sdk-common';

import type { FDv2ConnectionMode, ModeDefinition } from '../api/datasource';
import { arrayOf, recordOf, validatorOf } from '../configuration/validateOptions';

/**
 * A read-only mapping from each FDv2ConnectionMode to its ModeDefinition.
 */
type ModeTable = {
  readonly [K in FDv2ConnectionMode]: ModeDefinition;
};

const DEFAULT_FDV1_FALLBACK_POLL_INTERVAL_SECONDS = 300;
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

const initializerEntryArrayValidator = arrayOf('type', {
  cache: cacheEntryValidators,
  polling: pollingEntryValidators,
  streaming: streamingEntryValidators,
});

const synchronizerEntryArrayValidator = arrayOf('type', {
  polling: pollingEntryValidators,
  streaming: streamingEntryValidators,
});

const fdv1FallbackValidators = {
  pollInterval: TypeValidators.numberWithMin(30),
  endpoints: validatorOf(endpointValidators),
};

const modeDefinitionValidators = {
  initializers: initializerEntryArrayValidator,
  synchronizers: synchronizerEntryArrayValidator,
  fdv1Fallback: validatorOf(fdv1FallbackValidators),
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
    fdv1Fallback: { pollInterval: DEFAULT_FDV1_FALLBACK_POLL_INTERVAL_SECONDS },
  },
  polling: {
    initializers: [{ type: 'cache' }],
    synchronizers: [{ type: 'polling' }],
    fdv1Fallback: { pollInterval: DEFAULT_FDV1_FALLBACK_POLL_INTERVAL_SECONDS },
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
    fdv1Fallback: { pollInterval: BACKGROUND_POLL_INTERVAL_SECONDS },
  },
};

export type { ModeTable };
export {
  MODE_TABLE,
  MODE_DEFINITION_DEFAULTS,
  DEFAULT_FDV1_FALLBACK_POLL_INTERVAL_SECONDS,
  BACKGROUND_POLL_INTERVAL_SECONDS,
  connectionModeValidator,
  modeDefinitionValidators,
  connectionModesValidator,
};
