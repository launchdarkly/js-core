import {
  createSafeLogger,
  LDFlagSet,
  NumberWithMinimum,
  OptionMessages,
  TypeValidators,
} from '@launchdarkly/js-sdk-common';

import { LDInspection } from '../api/LDInspection';
import type LDOptions from '../api/LDOptions';
import validators from './validators';

export default class Configuration {
  public readonly logger = createSafeLogger();

  public readonly baseUri = 'https://sdk.launchdarkly.com';
  public readonly eventsUri = 'https://events.launchdarkly.com';
  public readonly streamUri = 'https://clientstream.launchdarkly.com';

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

  // Allow indexing Configuration by a string
  [index: string]: any;

  constructor(pristineOptions: LDOptions = {}) {
    const errors = this.validateTypesAndNames(pristineOptions);
    errors.forEach((e: string) => this.logger.warn(e));
  }

  validateTypesAndNames(pristineOptions: LDOptions): string[] {
    const errors: string[] = [];

    Object.entries(pristineOptions).forEach(([k, v]) => {
      const validator = validators[k as keyof LDOptions];

      if (validator) {
        if (!validator.is(v)) {
          if (validator.getType() === 'boolean') {
            errors.push(OptionMessages.wrongOptionTypeBoolean(k, typeof v));
            this[k] = !!v;
          } else if (validator instanceof NumberWithMinimum && TypeValidators.Number.is(v)) {
            const { min } = validator as NumberWithMinimum;
            errors.push(OptionMessages.optionBelowMinimum(k, v, min));
            this[k] = min;
          } else {
            errors.push(OptionMessages.wrongOptionType(k, validator.getType(), typeof v));
          }
        } else {
          this[k] = v;
        }
      } else {
        errors.push(OptionMessages.unknownOption(k));
      }
    });

    return errors;
  }
}
