import {
  ApplicationTags,
  createSafeLogger,
  internal,
  LDFlagSet,
  LDLogger,
  LDPluginEnvironmentMetadata,
  NumberWithMinimum,
  OptionMessages,
  SafeLogger,
  ServiceEndpoints,
  TypeValidators,
} from '@launchdarkly/js-sdk-common';

import { Hook, type LDOptions } from '../api';
import { LDInspection } from '../api/LDInspection';
import validators from './validators';

const DEFAULT_POLLING_INTERVAL: number = 60 * 5;

export interface LDClientInternalOptions extends internal.LDInternalOptions {
  trackEventModifier?: (event: internal.InputCustomEvent) => internal.InputCustomEvent;
  getImplementationHooks: (environmentMetadata: LDPluginEnvironmentMetadata) => Hook[];
  credentialType: 'clientSideId' | 'mobileKey';
  getLegacyStorageKeys?: () => string[];
}

export interface Configuration {
  readonly logger: LDLogger;
  readonly maxCachedContexts: number;
  readonly capacity: number;
  readonly diagnosticRecordingInterval: number;
  readonly flushInterval: number;
  readonly streamInitialReconnectDelay: number;
  readonly allAttributesPrivate: boolean;
  readonly debug: boolean;
  readonly diagnosticOptOut: boolean;
  readonly sendEvents: boolean;
  readonly sendLDHeaders: boolean;
  readonly useReport: boolean;
  readonly withReasons: boolean;
  readonly privateAttributes: string[];
  readonly tags: ApplicationTags;
  readonly applicationInfo?: {
    id?: string;
    version?: string;
    name?: string;
    versionName?: string;
  };
  readonly bootstrap?: LDFlagSet;
  readonly requestHeaderTransform?: (headers: Map<string, string>) => Map<string, string>;
  readonly stream?: boolean;
  readonly hash?: string;
  readonly wrapperName?: string;
  readonly wrapperVersion?: string;
  readonly serviceEndpoints: ServiceEndpoints;
  readonly pollInterval: number;
  readonly userAgentHeaderName: 'user-agent' | 'x-launchdarkly-user-agent';
  readonly trackEventModifier: (event: internal.InputCustomEvent) => internal.InputCustomEvent;
  readonly hooks: Hook[];
  readonly inspectors: LDInspection[];
  readonly credentialType: 'clientSideId' | 'mobileKey';
  readonly getImplementationHooks: (environmentMetadata: LDPluginEnvironmentMetadata) => Hook[];
}

const DEFAULT_POLLING: string = 'https://clientsdk.launchdarkly.com';
const DEFAULT_STREAM: string = 'https://clientstream.launchdarkly.com';

export { DEFAULT_POLLING, DEFAULT_STREAM };

function ensureSafeLogger(logger?: LDLogger): LDLogger {
  if (logger instanceof SafeLogger) {
    return logger;
  }
  // Even if logger is not defined this will produce a valid logger.
  return createSafeLogger(logger);
}

interface ConfigurationValues {
  logger: LDLogger;
  baseUri: string;
  eventsUri: string;
  streamUri: string;
  maxCachedContexts: number;
  capacity: number;
  diagnosticRecordingInterval: number;
  flushInterval: number;
  streamInitialReconnectDelay: number;
  allAttributesPrivate: boolean;
  debug: boolean;
  diagnosticOptOut: boolean;
  sendEvents: boolean;
  sendLDHeaders: boolean;
  useReport: boolean;
  withReasons: boolean;
  privateAttributes: string[];
  applicationInfo?: {
    id?: string;
    version?: string;
    name?: string;
    versionName?: string;
  };
  bootstrap?: LDFlagSet;
  requestHeaderTransform?: (headers: Map<string, string>) => Map<string, string>;
  stream?: boolean;
  hash?: string;
  wrapperName?: string;
  wrapperVersion?: string;
  pollInterval: number;
  hooks: Hook[];
  inspectors: LDInspection[];
  payloadFilterKey?: string;
  [index: string]: any;
}

export function createConfiguration(
  pristineOptions: LDOptions = {},
  internalOptions: LDClientInternalOptions = {
    getImplementationHooks: () => [],
    credentialType: 'mobileKey',
  },
): Configuration {
  const logger = ensureSafeLogger(pristineOptions.logger);

  const values: ConfigurationValues = {
    logger,
    baseUri: DEFAULT_POLLING,
    eventsUri: ServiceEndpoints.DEFAULT_EVENTS,
    streamUri: DEFAULT_STREAM,
    maxCachedContexts: 5,
    capacity: 100,
    diagnosticRecordingInterval: 900,
    flushInterval: 30,
    streamInitialReconnectDelay: 1,
    allAttributesPrivate: false,
    debug: false,
    diagnosticOptOut: false,
    sendEvents: true,
    sendLDHeaders: true,
    useReport: false,
    withReasons: false,
    privateAttributes: [],
    pollInterval: DEFAULT_POLLING_INTERVAL,
    hooks: [],
    inspectors: [],
  };

  // Validate options and update values
  Object.entries(pristineOptions).forEach(([k, v]) => {
    const validator = validators[k as keyof LDOptions];

    if (validator) {
      if (!validator.is(v)) {
        const validatorType = validator.getType();

        if (validatorType === 'boolean') {
          logger.warn(OptionMessages.wrongOptionTypeBoolean(k, typeof v));
          values[k] = !!v;
        } else if (validatorType === 'boolean | undefined | null') {
          logger.warn(OptionMessages.wrongOptionTypeBoolean(k, typeof v));

          if (typeof v !== 'boolean' && typeof v !== 'undefined' && v !== null) {
            values[k] = !!v;
          }
        } else if (validator instanceof NumberWithMinimum && TypeValidators.Number.is(v)) {
          const { min } = validator as NumberWithMinimum;
          logger.warn(OptionMessages.optionBelowMinimum(k, v, min));
          values[k] = min;
        } else {
          logger.warn(OptionMessages.wrongOptionType(k, validator.getType(), typeof v));
        }
      } else if (k === 'logger') {
        // Logger already assigned.
      } else {
        // if an option is explicitly null, coerce to undefined
        values[k] = v ?? undefined;
      }
    } else {
      logger.warn(OptionMessages.unknownOption(k));
    }
  });

  // Remove internal URI properties that shouldn't be on the final Configuration
  const { baseUri, eventsUri, streamUri, payloadFilterKey, ...configValues } = values;

  return {
    ...configValues,
    tags: new ApplicationTags({ application: values.applicationInfo, logger }),
    serviceEndpoints: new ServiceEndpoints(
      streamUri,
      baseUri,
      eventsUri,
      internalOptions.analyticsEventPath,
      internalOptions.diagnosticEventPath,
      internalOptions.includeAuthorizationHeader,
      payloadFilterKey,
    ),
    userAgentHeaderName: internalOptions.userAgentHeaderName ?? 'user-agent',
    trackEventModifier: internalOptions.trackEventModifier ?? ((event) => event),
    credentialType: internalOptions.credentialType,
    getImplementationHooks: internalOptions.getImplementationHooks,
  };
}
