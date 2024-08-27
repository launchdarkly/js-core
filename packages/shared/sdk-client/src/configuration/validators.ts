// eslint-disable-next-line max-classes-per-file
import { noop, TypeValidator, TypeValidators } from '@launchdarkly/js-sdk-common';

import { type LDOptions } from '../api';

class BootStrapValidator implements TypeValidator {
  is(u: unknown): boolean {
    return typeof u === 'object' || typeof u === 'undefined' || u === null;
  }

  getType(): string {
    return `LDFlagSet`;
  }
}

class ConnectionModeValidator implements TypeValidator {
  is(u: unknown): boolean {
    return u === 'offline' || u === 'streaming' || u === 'polling';
  }

  getType(): string {
    return `offline | streaming | polling`;
  }
}

const validators: Record<keyof LDOptions, TypeValidator> = {
  initialConnectionMode: new ConnectionModeValidator(),
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

  privateAttributes: TypeValidators.StringArray,

  applicationInfo: TypeValidators.Object,
  wrapperName: TypeValidators.String,
  wrapperVersion: TypeValidators.String,
};

export default validators;
