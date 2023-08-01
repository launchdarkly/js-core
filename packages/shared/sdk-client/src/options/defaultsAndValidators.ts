import {
  createSafeLogger,
  LDLogger,
  noop,
  TypeValidator,
  TypeValidators,
} from '@launchdarkly/js-sdk-common';

import { LDInspection } from '../api/LDInspection';
import LDOptions from './LDOptions';
import ValidatedOptions from './ValidatedOptions';

type KeyOf<T> = keyof T;
type ValueOf<T> = T[keyof T];

export type LDOptionKey = KeyOf<LDOptions>;
export type LDOptionValue = ValueOf<LDOptions>;

type Validation = {
  default: LDOptionValue;
  validator: TypeValidator;
};

export const defaultsAndValidators: Record<LDOptionKey, Validation> = {
  baseUri: {
    default: 'https://sdk.launchdarkly.com',
    validator: TypeValidators.String,
  },
  streamUri: {
    default: 'https://clientstream.launchdarkly.com',
    validator: TypeValidators.String,
  },
  eventsUri: {
    default: 'https://events.launchdarkly.com',
    validator: TypeValidators.String,
  },
  capacity: {
    default: 100,
    validator: TypeValidators.numberWithMin(1),
  },
  logger: {
    default: createSafeLogger() as LDLogger,
    validator: TypeValidators.Object,
  },
  flushInterval: {
    default: 2000,
    validator: TypeValidators.numberWithMin(2000),
  },
  stream: {
    default: undefined,
    validator: TypeValidators.Boolean,
  },
  sendEvents: {
    default: true,
    validator: TypeValidators.Boolean,
  },
  allAttributesPrivate: {
    default: false,
    validator: TypeValidators.Boolean,
  },
  privateAttributes: {
    default: [],
    validator: TypeValidators.StringArray,
  },
  diagnosticOptOut: {
    default: false,
    validator: TypeValidators.Boolean,
  },
  diagnosticRecordingInterval: {
    default: 900000,
    validator: TypeValidators.numberWithMin(2000),
  },
  wrapperName: {
    default: undefined,
    validator: TypeValidators.String,
  },
  wrapperVersion: {
    default: undefined,
    validator: TypeValidators.String,
  },
  application: {
    default: undefined,
    validator: TypeValidators.Object,
  },
  bootstrap: {
    default: undefined,
    validator: TypeValidators.Object,
  },
  useReport: {
    default: false,
    validator: TypeValidators.Boolean,
  },
  sendLDHeaders: {
    default: true,
    validator: TypeValidators.Boolean,
  },
  requestHeaderTransform: {
    default: undefined,
    validator: TypeValidators.Function,
  },
  evaluationReasons: {
    default: false,
    validator: TypeValidators.Boolean,
  },
  sendEventsOnlyForVariation: {
    default: false,
    validator: TypeValidators.Boolean,
  },
  streamReconnectDelay: {
    default: 1000,
    validator: TypeValidators.numberWithMin(0),
  },
  inspectors: {
    default: [],
    validator: TypeValidators.createTypeArray<LDInspection>('LDInspection[]', {
      type: 'flag-used',
      method: noop,
      name: '',
    }),
  },
};

export const getDefaults = () => {
  const defaults: LDOptions = {};
  Object.entries(defaultsAndValidators).forEach(([k, v]) => {
    defaults[k] = v?.default;
  });
  return defaults as ValidatedOptions;
};
