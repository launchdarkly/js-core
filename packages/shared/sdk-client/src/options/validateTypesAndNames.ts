import { NumberWithMinimum, OptionMessages, TypeValidators } from '@launchdarkly/js-sdk-common';
import { defaultsAndValidators, getDefaults } from './defaultsAndValidators';
import LDOptions from './LDOptions';

export default function validateTypesAndNames(options: LDOptions): {
  errors: string[];
  validatedOptions: LDOptions;
} {
  const errors: string[] = [];
  const validatedOptions = getDefaults();

  Object.entries(options).forEach(([k, v]) => {
    const validator = defaultsAndValidators[k]?.validator;

    if (validator) {
      if (!validator.is(v)) {
        if (validator.getType() === 'boolean') {
          errors.push(OptionMessages.wrongOptionTypeBoolean(k, typeof v));
          validatedOptions[k] = !!v;
        } else if (validator instanceof NumberWithMinimum && TypeValidators.Number.is(v)) {
          const { min } = validator as NumberWithMinimum;
          errors.push(OptionMessages.optionBelowMinimum(k, v, min));
          validatedOptions[k] = min;
        } else {
          errors.push(OptionMessages.wrongOptionType(k, validator.getType(), typeof v));
        }
      } else {
        validatedOptions[k] = v;
      }
    } else {
      options.logger?.warn(OptionMessages.unknownOption(k));
    }
  });

  return { errors, validatedOptions };
}
