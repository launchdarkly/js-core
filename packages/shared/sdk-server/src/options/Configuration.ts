import {
  ApplicationTags,
  internal,
  LDClientContext,
  LDLogger,
  NumberWithMinimum,
  OptionMessages,
  ServiceEndpoints,
  subsystem,
  TypeValidator,
  TypeValidators,
  VoidFunction,
} from '@launchdarkly/js-sdk-common';

import { LDBigSegmentsOptions, LDOptions, LDProxyOptions, LDTLSOptions } from '../api';
import { Hook } from '../api/integrations';
import {
  isPollingOptions,
  isStandardOptions,
  isStreamingOptions,
  LDDataSystemOptions,
  PollingDataSourceOptions,
  StandardDataSourceOptions,
  StreamingDataSourceOptions,
} from '../api/options/LDDataSystemOptions';
import { LDDataSourceUpdates, LDFeatureStore } from '../api/subsystems';
import InMemoryFeatureStore from '../store/InMemoryFeatureStore';
import { ValidatedOptions } from './ValidatedOptions';

// Once things are internal to the implementation of the SDK we can depend on
// types. Calls to the SDK could contain anything without any regard to typing.
// So, data we take from external sources must be normalized into something
// that can be trusted.

/**
 * These perform cursory validations. Complex objects are implemented with classes
 * and these should allow for conditional construction.
 */
const validations: Record<string, TypeValidator> = {
  baseUri: TypeValidators.String,
  streamUri: TypeValidators.String,
  eventsUri: TypeValidators.String,
  timeout: TypeValidators.Number,
  capacity: TypeValidators.Number,
  logger: TypeValidators.Object,
  featureStore: TypeValidators.ObjectOrFactory,
  dataSystem: TypeValidators.Object,
  bigSegments: TypeValidators.Object,
  updateProcessor: TypeValidators.ObjectOrFactory,
  flushInterval: TypeValidators.Number,
  pollInterval: TypeValidators.numberWithMin(30),
  proxyOptions: TypeValidators.Object,
  offline: TypeValidators.Boolean,
  stream: TypeValidators.Boolean,
  streamInitialReconnectDelay: TypeValidators.Number,
  useLdd: TypeValidators.Boolean,
  sendEvents: TypeValidators.Boolean,
  allAttributesPrivate: TypeValidators.Boolean,
  privateAttributes: TypeValidators.StringArray,
  contextKeysCapacity: TypeValidators.Number,
  contextKeysFlushInterval: TypeValidators.Number,
  tlsParams: TypeValidators.Object,
  diagnosticOptOut: TypeValidators.Boolean,
  diagnosticRecordingInterval: TypeValidators.numberWithMin(60),
  wrapperName: TypeValidators.String,
  wrapperVersion: TypeValidators.String,
  application: TypeValidators.Object,
  payloadFilterKey: TypeValidators.stringMatchingRegex(/^[a-zA-Z0-9](\w|\.|-)*$/),
  hooks: TypeValidators.createTypeArray('Hook[]', {}),
  type: TypeValidators.String,
};

const DEFAULT_POLL_INTERVAL = 30;
const DEFAULT_STREAM_RECONNECT_DELAY = 1;

const defaultStandardDataSourceOptions: StandardDataSourceOptions = {
  type: 'standard',
  streamInitialReconnectDelay: DEFAULT_STREAM_RECONNECT_DELAY,
  pollInterval: DEFAULT_POLL_INTERVAL,
};

const defaultStreamingDataSourceOptions: StreamingDataSourceOptions = {
  type: 'streaming',
  streamInitialReconnectDelay: DEFAULT_STREAM_RECONNECT_DELAY,
};

const defaultPollingDataSourceOptions: PollingDataSourceOptions = {
  type: 'polling',
  pollInterval: DEFAULT_POLL_INTERVAL,
};

const defaultDataSystemOptions = {
  dataSource: defaultStandardDataSourceOptions,
};

/**
 * @internal
 */
export const defaultValues: ValidatedOptions = {
  baseUri: 'https://sdk.launchdarkly.com',
  streamUri: 'https://stream.launchdarkly.com',
  eventsUri: ServiceEndpoints.DEFAULT_EVENTS,
  stream: true,
  streamInitialReconnectDelay: DEFAULT_STREAM_RECONNECT_DELAY,
  sendEvents: true,
  timeout: 5,
  capacity: 10000,
  flushInterval: 5,
  pollInterval: DEFAULT_POLL_INTERVAL,
  offline: false,
  useLdd: false,
  allAttributesPrivate: false,
  privateAttributes: [],
  contextKeysCapacity: 1000,
  contextKeysFlushInterval: 300,
  diagnosticOptOut: false,
  diagnosticRecordingInterval: 900,
  featureStore: () => new InMemoryFeatureStore(),
  dataSystem: defaultDataSystemOptions,
};

// General options type needed by validation algorithm.  Specific types can be asserted after use.
type Options = {
  [k: string]: any;
};

function validateTypesAndNames(
  options: Options,
  defaults: Options,
): {
  errors: string[];
  validatedOptions: Options;
} {
  const errors: string[] = [];
  const validatedOptions: Options = { ...defaults };
  Object.keys(options).forEach((optionName) => {
    // We need to tell typescript it doesn't actually know what options are.
    // If we don't then it complains we are doing crazy things with it.
    const optionValue = (options as unknown as any)[optionName];
    const validator = validations[optionName];
    if (validator) {
      if (!validator.is(optionValue)) {
        if (validator.getType() === 'boolean') {
          errors.push(OptionMessages.wrongOptionTypeBoolean(optionName, typeof optionValue));
          validatedOptions[optionName] = !!optionValue;
        } else if (
          validator instanceof NumberWithMinimum &&
          TypeValidators.Number.is(optionValue)
        ) {
          const { min } = validator as NumberWithMinimum;
          errors.push(OptionMessages.optionBelowMinimum(optionName, optionValue, min));
          validatedOptions[optionName] = min;
        } else {
          errors.push(
            OptionMessages.wrongOptionType(optionName, validator.getType(), typeof optionValue),
          );
          validatedOptions[optionName] = defaultValues[optionName];
        }
      } else {
        validatedOptions[optionName] = optionValue;
      }
    } else {
      options.logger?.warn(OptionMessages.unknownOption(optionName));
    }
  });
  return { errors, validatedOptions };
}

function validateEndpoints(options: LDOptions, validatedOptions: Options) {
  const { baseUri, streamUri, eventsUri } = options;
  const streamingEndpointSpecified = streamUri !== undefined && streamUri !== null;
  const pollingEndpointSpecified = baseUri !== undefined && baseUri !== null;
  const eventEndpointSpecified = eventsUri !== undefined && eventsUri !== null;

  if (
    streamingEndpointSpecified === pollingEndpointSpecified &&
    streamingEndpointSpecified === eventEndpointSpecified
  ) {
    // Either everything is default, or everything is set.
    return;
  }

  if (!streamingEndpointSpecified && validatedOptions.stream) {
    validatedOptions.logger?.warn(OptionMessages.partialEndpoint('streamUri'));
  }

  if (!pollingEndpointSpecified) {
    validatedOptions.logger?.warn(OptionMessages.partialEndpoint('baseUri'));
  }

  if (!eventEndpointSpecified && validatedOptions.sendEvents) {
    validatedOptions.logger?.warn(OptionMessages.partialEndpoint('eventsUri'));
  }
}

function validateDataSystemOptions(options: Options): {
  errors: string[];
  validatedOptions: Options;
} {
  const allErrors: string[] = [];
  const validatedOptions: Options = { ...options };

  if (!TypeValidators.ObjectOrFactory.is(options.persistentStore)) {
    validatedOptions.persistentStore = undefined; // default is to not use this
    allErrors.push(
      OptionMessages.wrongOptionType(
        'persistentStore',
        'LDFeatureStore',
        typeof options.persistentStore,
      ),
    );
  }

  if (!TypeValidators.ObjectOrFactory.is(options.updateProcessor)) {
    validatedOptions.persistentStore = undefined; // default is to not use this
    allErrors.push(
      OptionMessages.wrongOptionType(
        'updateProcessor',
        'UpdateProcessor',
        typeof options.persistentStore,
      ),
    );
  }

  let result: { errors: string[]; validatedOptions: Options };
  let validatedDataSourceOptions;
  if (isStandardOptions(options.dataSource)) {
    result = validateTypesAndNames(options.dataSource, defaultStandardDataSourceOptions);
  } else if (isStreamingOptions(options.dataSource)) {
    result = validateTypesAndNames(options.dataSource, defaultStreamingDataSourceOptions);
  } else if (isPollingOptions(options.dataSource)) {
    result = validateTypesAndNames(options.dataSource, defaultPollingDataSourceOptions);
  } else {
    // provided datasource options don't fit any expected form, drop them and use defaults
    result = {
      errors: [
        OptionMessages.wrongOptionType(
          'dataSource',
          'DataSourceOptions',
          typeof options.dataSource,
        ),
      ],
      validatedOptions: defaultStandardDataSourceOptions,
    };
  }

  validatedOptions.dataSource = validatedDataSourceOptions;
  allErrors.concat(result.errors);
  return { errors: allErrors, validatedOptions };
}

/**
 * Configuration options for the LDClient.
 *
 * @internal
 */
export default class Configuration {
  public readonly serviceEndpoints: ServiceEndpoints;

  public readonly eventsCapacity: number;

  public readonly timeout: number;

  public readonly logger?: LDLogger;

  public readonly flushInterval: number;

  public readonly proxyOptions?: LDProxyOptions;

  public readonly offline: boolean;

  public readonly useLdd: boolean;

  public readonly sendEvents: boolean;

  public readonly allAttributesPrivate: boolean;

  public readonly privateAttributes: string[];

  public readonly contextKeysCapacity: number;

  public readonly contextKeysFlushInterval: number;

  public readonly tlsParams?: LDTLSOptions;

  public readonly diagnosticOptOut: boolean;

  public readonly wrapperName?: string;

  public readonly wrapperVersion?: string;

  public readonly tags: ApplicationTags;

  public readonly payloadFilterKey?: string;

  public readonly diagnosticRecordingInterval: number;

  public readonly featureStoreFactory: (clientContext: LDClientContext) => LDFeatureStore;

  public readonly dataSystem: LDDataSystemOptions;

  public readonly updateProcessorFactory?: (
    clientContext: LDClientContext,
    dataSourceUpdates: LDDataSourceUpdates,
    initSuccessHandler: VoidFunction,
    errorHandler?: (e: Error) => void,
  ) => subsystem.LDStreamProcessor;

  public readonly bigSegments?: LDBigSegmentsOptions;

  public readonly hooks?: Hook[];

  constructor(options: LDOptions = {}, internalOptions: internal.LDInternalOptions = {}) {
    // The default will handle undefined, but not null.
    // Because we can be called from JS we need to be extra defensive.
    // eslint-disable-next-line no-param-reassign
    options = options || {};
    // If there isn't a valid logger from the platform, then logs would go nowhere.
    this.logger = options.logger;

    const { errors, validatedOptions: topLevelResult } = validateTypesAndNames(
      options,
      defaultValues,
    );
    const validatedOptions = topLevelResult as ValidatedOptions;
    errors.forEach((error) => {
      this.logger?.warn(error);
    });

    validateEndpoints(options, validatedOptions);

    if (options.dataSystem) {
      // validate the data system options, this will also apply reasonable defaults
      const { errors: dsErrors, validatedOptions: dsResult } = validateDataSystemOptions(
        options.dataSystem,
      );
      this.dataSystem = dsResult as LDDataSystemOptions;
      dsErrors.forEach((error) => {
        this.logger?.warn(error);
      });
    } else {
      // if no data system was specified (such as implmentations using this SDK before data system
      // was added), we'll make one based on the stream option
      this.dataSystem = {
        dataSource: options.stream
          ? {
              type: 'streaming',
              streamInitialReconnectDelay: validatedOptions.streamInitialReconnectDelay,
            }
          : {
              type: 'polling',
              pollInterval: validatedOptions.pollInterval,
            },
      };
    }

    this.serviceEndpoints = new ServiceEndpoints(
      validatedOptions.streamUri,
      validatedOptions.baseUri,
      validatedOptions.eventsUri,
      internalOptions.analyticsEventPath,
      internalOptions.diagnosticEventPath,
      internalOptions.includeAuthorizationHeader,
      validatedOptions.payloadFilterKey,
    );
    this.eventsCapacity = validatedOptions.capacity;
    this.timeout = validatedOptions.timeout;

    this.bigSegments = validatedOptions.bigSegments;
    this.flushInterval = validatedOptions.flushInterval;
    this.proxyOptions = validatedOptions.proxyOptions;

    this.sendEvents = validatedOptions.sendEvents;
    this.allAttributesPrivate = validatedOptions.allAttributesPrivate;
    this.privateAttributes = validatedOptions.privateAttributes;
    this.contextKeysCapacity = validatedOptions.contextKeysCapacity;
    this.contextKeysFlushInterval = validatedOptions.contextKeysFlushInterval;
    this.tlsParams = validatedOptions.tlsParams;
    this.diagnosticOptOut = validatedOptions.diagnosticOptOut;
    this.wrapperName = validatedOptions.wrapperName;
    this.payloadFilterKey = validatedOptions.payloadFilterKey;
    this.wrapperVersion = validatedOptions.wrapperVersion;
    this.tags = new ApplicationTags(validatedOptions);
    this.diagnosticRecordingInterval = validatedOptions.diagnosticRecordingInterval;
    this.hooks = validatedOptions.hooks;

    this.offline = validatedOptions.offline;
    this.useLdd = validatedOptions.useLdd;

    if (TypeValidators.Function.is(validatedOptions.updateProcessor)) {
      // @ts-ignore
      this.updateProcessorFactory = validatedOptions.updateProcessor;
    } else {
      // The processor is already created, just have the method return it.
      // @ts-ignore
      this.updateProcessorFactory = () => validatedOptions.updateProcessor;
    }

    if (TypeValidators.Function.is(validatedOptions.featureStore)) {
      // @ts-ignore
      this.featureStoreFactory = validatedOptions.featureStore;
    } else {
      // The store is already created, just have the method return it.
      // @ts-ignore
      this.featureStoreFactory = () => validatedOptions.featureStore;
    }
  }
}
