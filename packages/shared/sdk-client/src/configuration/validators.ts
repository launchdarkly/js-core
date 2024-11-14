// eslint-disable-next-line max-classes-per-file
import { TypeValidator, TypeValidators } from '@launchdarkly/js-sdk-common';

import { type LDOptions } from '../api';

const validators: Record<keyof LDOptions, TypeValidator> = {
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

  applicationInfo: TypeValidators.Object,
  wrapperName: TypeValidators.String,
  wrapperVersion: TypeValidators.String,
  payloadFilterKey: TypeValidators.stringMatchingRegex(/^[a-zA-Z0-9](\w|\.|-)*$/),
  hooks: TypeValidators.createTypeArray('Hook[]', {}),
  inspectors: TypeValidators.createTypeArray('LDInspection', {}),
};

export default validators;
