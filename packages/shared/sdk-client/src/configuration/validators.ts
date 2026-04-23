import { TypeValidator, TypeValidators } from '@launchdarkly/js-sdk-common';

import { type LDOptions } from '../api';
import { MODE_TABLE } from '../datasource/ConnectionModeConfig';
import {
  dataSystemValidators,
  type PlatformDataSystemDefaults,
} from '../datasource/LDClientDataSystemOptions';
import { validatorOf } from './validateOptions';

export interface ValidatorOptions {
  dataSystemDefaults?: PlatformDataSystemDefaults;
}

export default function createValidators(
  options?: ValidatorOptions,
): Record<keyof LDOptions, TypeValidator> {
  return {
    logger: TypeValidators.Object,
    maxCachedContexts: TypeValidators.numberWithMin(0),

    baseUri: TypeValidators.String,
    streamUri: TypeValidators.String,
    eventsUri: TypeValidators.String,

    capacity: TypeValidators.numberWithMin(1),
    diagnosticRecordingInterval: TypeValidators.numberWithMin(2),
    flushInterval: TypeValidators.numberWithMin(2),
    streamInitialReconnectDelay: TypeValidators.numberWithMin(0),

    allAttributesPrivate: TypeValidators.Boolean,
    debug: TypeValidators.Boolean,
    diagnosticOptOut: TypeValidators.Boolean,
    withReasons: TypeValidators.Boolean,
    sendEvents: TypeValidators.Boolean,

    pollInterval: TypeValidators.numberWithMin(30),

    useReport: TypeValidators.Boolean,

    privateAttributes: TypeValidators.StringArray,

    disableCache: TypeValidators.Boolean,
    applicationInfo: TypeValidators.Object,
    wrapperName: TypeValidators.String,
    wrapperVersion: TypeValidators.String,
    payloadFilterKey: TypeValidators.stringMatchingRegex(/^[a-zA-Z0-9](\w|\.|-)*$/),
    hooks: TypeValidators.createTypeArray('Hook[]', {}),
    inspectors: TypeValidators.createTypeArray('LDInspection', {}),
    cleanOldPersistentData: TypeValidators.Boolean,
    dataSystem: options?.dataSystemDefaults ?
        validatorOf(dataSystemValidators, {
          defaults: {
            ...options.dataSystemDefaults,
            connectionModes: MODE_TABLE,
          } as unknown as Record<string, unknown>,
        }) :
      TypeValidators.Object,
  };
}
