import {
  createSafeLogger,
  LDFlagSet,
  NumberWithMinimum,
  OptionMessages,
  ServiceEndpoints,
  TypeValidators,
} from '@launchdarkly/js-sdk-common';

import { LDInspection } from '../api/LDInspection';
import type LDOptions from '../api/LDOptions';
import validators from './validators';

export const DEFAULT_BASE_URI = 'https://sdk.launchdarkly.com';
export const DEFAULT_EVENTS_URI = 'https://events.launchdarkly.com';
export const DEFAULT_STREAM_URI = 'https://clientstream.launchdarkly.com';

export default class Configuration {
  public readonly logger = createSafeLogger();

  public readonly baseUri = DEFAULT_BASE_URI;
  public readonly eventsUri = DEFAULT_EVENTS_URI;
  public readonly streamUri = DEFAULT_STREAM_URI;

  public readonly capacity = 100;
  public readonly diagnosticRecordingInterval = 900000;
  public readonly flushInterval = 2000;
  public readonly streamReconnectDelay = 1000;

  public readonly allAttributesPrivate = false;
  public readonly diagnosticOptOut = false;
  public readonly evaluationReasons = false;
  public readonly sendEvents = true;
  public readonly sendEventsOnlyForVariation = false;
  public readonly sendLDHeaders = true;
  public readonly useReport = false;

  public readonly inspectors: LDInspection[] = [];
  public readonly privateAttributes: string[] = [];

  public readonly application?: { id?: string; version?: string };
  public readonly bootstrap?: 'localStorage' | LDFlagSet;
  public readonly requestHeaderTransform?: (headers: Map<string, string>) => Map<string, string>;
  public readonly stream?: boolean;
  public readonly wrapperName?: string;
  public readonly wrapperVersion?: string;

  public readonly serviceEndpoints: ServiceEndpoints;

  // Allow indexing Configuration by a string
  [index: string]: any;

  constructor(pristineOptions: LDOptions = {}) {
    const errors = this.validateTypesAndNames(pristineOptions);
    errors.forEach((e: string) => this.logger.warn(e));

    this.serviceEndpoints = new ServiceEndpoints(this.streamUri, this.baseUri, this.eventsUri);
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
