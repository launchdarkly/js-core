import {
  LDLogger,
  LDOptions,
  OptionMessages,
  TypeValidator,
  TypeValidators,
} from '@launchdarkly/js-client-sdk-common';

import RNOptions from './RNOptions';

export interface ValidatedOptions {
  runInBackground: boolean;
  automaticNetworkHandling: boolean;
  automaticBackgroundHandling: boolean;
}

const optDefaults = {
  runInBackground: false,
  automaticNetworkHandling: true,
  automaticBackgroundHandling: true,
};

const validators: { [Property in keyof RNOptions]: TypeValidator | undefined } = {
  runInBackground: TypeValidators.Boolean,
  automaticNetworkHandling: TypeValidators.Boolean,
  automaticBackgroundHandling: TypeValidators.Boolean,
};

export function getConfigKeys() {
  return Object.keys(optDefaults);
}

export function filterToBaseOptions(opts: RNOptions): LDOptions {
  const baseOptions: LDOptions = { ...opts };

  // Remove any RN specific configuration keys so we don't get warnings from
  // the base implementation for unknown configuration.
  getConfigKeys().forEach((key) => {
    delete (baseOptions as any)[key];
  });
  return baseOptions;
}

export default function validateOptions(opts: RNOptions, logger: LDLogger): ValidatedOptions {
  const output: ValidatedOptions = { ...optDefaults };

  Object.entries(validators).forEach((entry) => {
    const [key, validator] = entry as [keyof RNOptions, TypeValidator];
    const value = opts[key];
    if (value !== undefined) {
      if (validator.is(value)) {
        output[key as keyof ValidatedOptions] = value as any;
      } else {
        logger.warn(OptionMessages.wrongOptionType(key, validator.getType(), typeof value));
      }
    }
  });

  return output;
}
