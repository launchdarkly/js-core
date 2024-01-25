import { noop, TypeValidator, TypeValidators } from '@launchdarkly/js-sdk-common';

import { type LDOptions } from '../api';
import { LDInspection } from '../api/LDInspection';

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

  autoEnvAttributes: TypeValidators.Boolean,
  allAttributesPrivate: TypeValidators.Boolean,
  diagnosticOptOut: TypeValidators.Boolean,
  withReasons: TypeValidators.Boolean,
  sendEvents: TypeValidators.Boolean,

  inspectors: TypeValidators.createTypeArray<LDInspection>('LDInspection[]', {
    type: 'flag-used',
    method: noop,
    name: '',
  }),
  privateAttributes: TypeValidators.StringArray,

  application: TypeValidators.Object,
  bootstrap: new BootStrapValidator(),
  wrapperName: TypeValidators.String,
  wrapperVersion: TypeValidators.String,
  hash: TypeValidators.String,
};

export default validators;
