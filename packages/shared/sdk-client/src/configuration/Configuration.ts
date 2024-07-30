import {
  ApplicationTags,
  createSafeLogger,
  internal,
  LDFlagSet,
  NumberWithMinimum,
  OptionMessages,
  ServiceEndpoints,
  TypeValidators,
} from '@launchdarkly/js-sdk-common';

import { ConnectionMode, type LDOptions } from '../api';
import { LDInspection } from '../api/LDInspection';
import validators from './validators';

const DEFAULT_POLLING_INTERVAL: number = 60 * 5;

export default class Configuration {
  public static DEFAULT_POLLING = 'https://clientsdk.launchdarkly.com';
  public static DEFAULT_STREAM = 'https://clientstream.launchdarkly.com';

  public readonly logger = createSafeLogger();

  public readonly baseUri = Configuration.DEFAULT_POLLING;
  public readonly eventsUri = ServiceEndpoints.DEFAULT_EVENTS;
  public readonly streamUri = Configuration.DEFAULT_STREAM;

  public readonly capacity = 100;
  public readonly diagnosticRecordingInterval = 900;
  public readonly flushInterval = 30;
  public readonly streamInitialReconnectDelay = 1;

  public readonly allAttributesPrivate = false;
  public readonly debug = false;
  public readonly diagnosticOptOut = false;
  public readonly sendEvents = true;
  public readonly sendLDHeaders = true;

  public readonly useReport = false;
  public readonly withReasons = false;

  public readonly inspectors: LDInspection[] = [];
  public readonly privateAttributes: string[] = [];

  public readonly initialConnectionMode: ConnectionMode = 'streaming';

  public readonly tags: ApplicationTags;
  public readonly applicationInfo?: {
    id?: string;
    version?: string;
    name?: string;
    versionName?: string;
  };
  public readonly bootstrap?: LDFlagSet;

  // TODO: implement requestHeaderTransform
  public readonly requestHeaderTransform?: (headers: Map<string, string>) => Map<string, string>;
  public readonly stream?: boolean;
  public readonly hash?: string;
  public readonly wrapperName?: string;
  public readonly wrapperVersion?: string;

  public readonly serviceEndpoints: ServiceEndpoints;

  public readonly pollInterval: number = DEFAULT_POLLING_INTERVAL;

  // Allow indexing Configuration by a string
  [index: string]: any;

  constructor(pristineOptions: LDOptions = {}, internalOptions: internal.LDInternalOptions = {}) {
    const errors = this.validateTypesAndNames(pristineOptions);
    errors.forEach((e: string) => this.logger.warn(e));

    this.serviceEndpoints = new ServiceEndpoints(
      this.streamUri,
      this.baseUri,
      this.eventsUri,
      internalOptions.analyticsEventPath,
      internalOptions.diagnosticEventPath,
      internalOptions.includeAuthorizationHeader,
    );
    this.tags = new ApplicationTags({ application: this.applicationInfo, logger: this.logger });
  }

  validateTypesAndNames(pristineOptions: LDOptions): string[] {
    const errors: string[] = [];

    Object.entries(pristineOptions).forEach(([k, v]) => {
      const validator = validators[k as keyof LDOptions];

      if (validator) {
        if (!validator.is(v)) {
          const validatorType = validator.getType();

          if (validatorType === 'boolean') {
            errors.push(OptionMessages.wrongOptionTypeBoolean(k, typeof v));
            this[k] = !!v;
          } else if (validatorType === 'boolean | undefined | null') {
            errors.push(OptionMessages.wrongOptionTypeBoolean(k, typeof v));

            if (typeof v !== 'boolean' && typeof v !== 'undefined' && v !== null) {
              this[k] = !!v;
            }
          } else if (validator instanceof NumberWithMinimum && TypeValidators.Number.is(v)) {
            const { min } = validator as NumberWithMinimum;
            errors.push(OptionMessages.optionBelowMinimum(k, v, min));
            this[k] = min;
          } else {
            errors.push(OptionMessages.wrongOptionType(k, validator.getType(), typeof v));
          }
        } else {
          // if an option is explicitly null, coerce to undefined
          this[k] = v ?? undefined;
        }
      } else {
        errors.push(OptionMessages.unknownOption(k));
      }
    });

    return errors;
  }
}
