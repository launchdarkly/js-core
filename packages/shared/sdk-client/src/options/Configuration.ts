import { LDFlagSet, LDLogger } from '@launchdarkly/js-sdk-common';

import { LDInspection } from '../api/LDInspection';
import { getDefaults } from './defaultsAndValidators';
import LDOptions from './LDOptions';
import validateTypesAndNames from './validateTypesAndNames';

export default class Configuration {
  // these ! properties are initialized dynamically in the constructor
  public readonly baseUri!: string;
  public readonly streamUri!: string;
  public readonly eventsUri!: string;
  public readonly capacity!: number;
  public readonly logger!: LDLogger;
  public readonly flushInterval!: number;
  public readonly sendEvents!: boolean;
  public readonly allAttributesPrivate!: boolean;
  public readonly privateAttributes!: string[];
  public readonly diagnosticOptOut!: boolean;
  public readonly diagnosticRecordingInterval!: number;
  public readonly useReport!: boolean;
  public readonly sendLDHeaders!: boolean;
  public readonly evaluationReasons!: boolean;
  public readonly sendEventsOnlyForVariation!: boolean;
  public readonly streamReconnectDelay!: number;
  public readonly inspectors!: LDInspection[];

  public readonly application?: { id?: string; version?: string };
  public readonly bootstrap?: LDFlagSet;
  public readonly requestHeaderTransform?: (headers: Map<string, string>) => Map<string, string>;
  public readonly stream?: boolean;
  public readonly wrapperName?: string;
  public readonly wrapperVersion?: string;

  // Allow indexing Configuration by a string
  [index: string]: any;

  constructor(options: LDOptions = {}) {
    const { errors, validatedOptions } = validateTypesAndNames({ ...getDefaults(), ...options });

    Object.entries(validatedOptions).forEach(([k, v]) => {
      this[k] = v;
    });

    errors.forEach((e) => this.logger.warn(e));
  }
}
