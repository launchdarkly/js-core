// eslint-disable-next-line max-classes-per-file
import { LDLogger, LDOptions } from '../api';
import OptionMessages from './OptionMessages';
import ServiceEndpoints from './ServiceEndpoints';
import TypeValidators, { TypeValidator } from './validators';

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
  featureStore: TypeValidators.Object,
  bigSegments: TypeValidators.Object,
  updateProcessor: TypeValidators.ObjectOrFactory,
  flushInterval: TypeValidators.Number,
  pollInterval: TypeValidators.Number,
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
  diagnosticRecordingInterval: TypeValidators.Number,
  wrapperName: TypeValidators.String,
  wrapperVersion: TypeValidators.String,
  application: TypeValidators.Object,
};

const defaultValues: Record<string, any> = {
  baseUri: 'https://app.launchdarkly.com',
  streamUri: 'https://stream.launchdarkly.com',
  eventsUri: 'https://events.launchdarkly.com',
  stream: true,
  streamInitialReconnectDelay: 1,
  sendEvents: true,
  timeout: 5,
  capacity: 10000,
  flushInterval: 5,
  pollInterval: 30,
  offline: false,
  useLdd: false,
  allAttributesPrivate: false,
  privateAttributes: [],
  contextKeysCapacity: 1000,
  contextKeysFlushInterval: 300,
  diagnosticOptOut: false,
  diagnosticRecordingInterval: 900,
  // TODO: Implement once available.
  // featureStore: InMemoryFeatureStore(),
};

function validateTypesAndNames(options: LDOptions): {
  errors: string[], validatedOptions: LDOptions
} {
  const errors: string[] = [];
  const validatedOptions: Record<string, any> = {};
  Object.keys(options).forEach((optionName) => {
    // We need to tell typescript it doesn't actually know what options are.
    // If we don't then it complains we are doing crazy things with it.
    const optionValue = (options as unknown as any)[optionName];
    const validator = validations[optionName];
    if (validator) {
      if (!validator.is(optionValue)) {
        if (validator.getType() === 'boolean') {
          errors.push(OptionMessages.wrongOptionTypeBoolean(
            optionName,
            typeof optionValue,
          ));
          validatedOptions[optionName] = !!optionValue;
        } else {
          errors.push(OptionMessages.wrongOptionType(
            optionName,
            validator.getType(),
            typeof optionValue,
          ));
          validatedOptions[optionName] = defaultValues[optionName];
        }
      } else {
        validatedOptions[optionName] = optionValue;
      }
    }
  });
  return { errors, validatedOptions };
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

  public readonly pollInterval: number;

  constructor(options: LDOptions) {
    // If there isn't a valid logger from the platform, then logs would go nowhere.
    this.logger = options.logger;

    const { errors, validatedOptions } = validateTypesAndNames(options);
    errors.forEach((error) => {
      this.logger?.warn(error);
    });

    this.serviceEndpoints = ServiceEndpoints.FromOptions(validatedOptions);
    // We know these options are valid now, so we cast away the uncertainty.
    this.eventsCapacity = validatedOptions.capacity as number;
    this.timeout = validatedOptions.timeout as number;
    // TODO: featureStore
    // TODO: bigSegments
    // TODO: updateProcessor
    this.flushInterval = validatedOptions.flushInterval as number;
    this.pollInterval = validatedOptions.pollInterval as number;

    // this.serviceEndpoints = ServiceEndpoints.FromOptions(options);
  }
}
