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

import { type LDOptions } from '../api';
import validators from './validators';

const DEFAULT_POLLING_INTERVAL: number = 60 * 5;

export interface LDClientInternalOptions extends internal.LDInternalOptions {
  trackEventModifier?: (event: internal.InputCustomEvent) => internal.InputCustomEvent;
}

export interface Configuration {
  readonly logger: ReturnType<typeof createSafeLogger>;
  readonly baseUri: string;
  readonly eventsUri: string;
  readonly streamUri: string;
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
}

export default class ConfigurationImpl implements Configuration {
  public static DEFAULT_POLLING = 'https://clientsdk.launchdarkly.com';
  public static DEFAULT_STREAM = 'https://clientstream.launchdarkly.com';

  public readonly logger = createSafeLogger();

  public readonly baseUri = ConfigurationImpl.DEFAULT_POLLING;
  public readonly eventsUri = ServiceEndpoints.DEFAULT_EVENTS;
  public readonly streamUri = ConfigurationImpl.DEFAULT_STREAM;

  public readonly maxCachedContexts = 5;

  public readonly capacity = 100;
  public readonly diagnosticRecordingInterval = 900;
  public readonly flushInterval = 30;
  public readonly streamInitialReconnectDelay = 1;

  public readonly allAttributesPrivate: boolean = false;
  public readonly debug: boolean = false;
  public readonly diagnosticOptOut: boolean = false;
  public readonly sendEvents: boolean = true;
  public readonly sendLDHeaders: boolean = true;

  public readonly useReport: boolean = false;
  public readonly withReasons: boolean = false;

  public readonly privateAttributes: string[] = [];

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

  public readonly userAgentHeaderName: 'user-agent' | 'x-launchdarkly-user-agent';

  public readonly trackEventModifier: (
    event: internal.InputCustomEvent,
  ) => internal.InputCustomEvent;

  // Allow indexing Configuration by a string
  [index: string]: any;

  constructor(pristineOptions: LDOptions = {}, internalOptions: LDClientInternalOptions = {}) {
    const errors = this.validateTypesAndNames(pristineOptions);
    errors.forEach((e: string) => this.logger.warn(e));

    this.serviceEndpoints = new ServiceEndpoints(
      this.streamUri,
      this.baseUri,
      this.eventsUri,
      internalOptions.analyticsEventPath,
      internalOptions.diagnosticEventPath,
      internalOptions.includeAuthorizationHeader,
      pristineOptions.payloadFilterKey,
    );
    this.useReport = pristineOptions.useReport ?? false;

    this.tags = new ApplicationTags({ application: this.applicationInfo, logger: this.logger });
    this.userAgentHeaderName = internalOptions.userAgentHeaderName ?? 'user-agent';
    this.trackEventModifier = internalOptions.trackEventModifier ?? ((event) => event);
  }

  private validateTypesAndNames(pristineOptions: LDOptions): string[] {
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
