import { noop, TypeValidator, TypeValidators } from '@launchdarkly/js-sdk-common';

import { LDInspection } from '../api/LDInspection';
import LDOptions from '../api/LDOptions';

class BootStrapValidator implements TypeValidator {
  is(u: unknown): boolean {
    return u === 'localStorage' || typeof u === 'object' || typeof u === 'undefined' || u === null;
  }

  getType(): string {
    return `'localStorage' | LDFlagSet`;
  }
}

const validators: Record<keyof LDOptions, TypeValidator> = {
  logger: TypeValidators.Object,

  baseUri: TypeValidators.String,
  streamUri: TypeValidators.String,
  eventsUri: TypeValidators.String,

  capacity: TypeValidators.numberWithMin(1),
  diagnosticRecordingInterval: TypeValidators.numberWithMin(2),
  flushInterval: TypeValidators.numberWithMin(2),
  streamInitialReconnectDelay: TypeValidators.numberWithMin(0),

  allAttributesPrivate: TypeValidators.Boolean,
  diagnosticOptOut: TypeValidators.Boolean,
  evaluationReasons: TypeValidators.Boolean,
  sendEvents: TypeValidators.Boolean,
  sendLDHeaders: TypeValidators.Boolean,
  useReport: TypeValidators.Boolean,

  inspectors: TypeValidators.createTypeArray<LDInspection>('LDInspection[]', {
    type: 'flag-used',
    method: noop,
    name: '',
  }),
  privateAttributes: TypeValidators.StringArray,

  application: TypeValidators.Object,
  bootstrap: new BootStrapValidator(),
  requestHeaderTransform: TypeValidators.Function,
  stream: TypeValidators.NullableBoolean,
  wrapperName: TypeValidators.String,
  wrapperVersion: TypeValidators.String,
  hash: TypeValidators.String,
};

export default validators;
