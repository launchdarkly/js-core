import { noop, TypeValidator, TypeValidators } from '@launchdarkly/js-sdk-common';

import { LDInspection } from '../api/LDInspection';
import LDOptions from '../api/LDOptions';

const validators: Record<keyof LDOptions, TypeValidator> = {
  logger: TypeValidators.Object,

  baseUri: TypeValidators.String,
  streamUri: TypeValidators.String,
  eventsUri: TypeValidators.String,

  capacity: TypeValidators.numberWithMin(1),
  diagnosticRecordingInterval: TypeValidators.numberWithMin(2000),
  flushInterval: TypeValidators.numberWithMin(2000),
  streamReconnectDelay: TypeValidators.numberWithMin(0),

  allAttributesPrivate: TypeValidators.Boolean,
  diagnosticOptOut: TypeValidators.Boolean,
  evaluationReasons: TypeValidators.Boolean,
  sendEvents: TypeValidators.Boolean,
  sendEventsOnlyForVariation: TypeValidators.Boolean,
  sendLDHeaders: TypeValidators.Boolean,
  useReport: TypeValidators.Boolean,

  inspectors: TypeValidators.createTypeArray<LDInspection>('LDInspection[]', {
    type: 'flag-used',
    method: noop,
    name: '',
  }),
  privateAttributes: TypeValidators.StringArray,

  application: TypeValidators.Object,
  bootstrap: TypeValidators.Object,
  requestHeaderTransform: TypeValidators.Function,
  stream: TypeValidators.NullableBoolean,
  wrapperName: TypeValidators.String,
  wrapperVersion: TypeValidators.String,
};

export default validators;
