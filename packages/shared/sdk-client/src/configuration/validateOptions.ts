import {
  isNullish,
  LDLogger,
  NumberWithMinimum,
  OptionMessages,
  TypeValidator,
  TypeValidators,
} from '@launchdarkly/js-sdk-common';

/**
 * Validates an options object against a map of validators and defaults.
 *
 * For each key in `input`:
 * - If a validator exists and the value passes, the value is used.
 * - If a validator exists and the value fails:
 *   - Booleans are coerced.
 *   - Numbers below a minimum are clamped.
 *   - Other types fall back to the default.
 * - If no validator exists, a warning is logged and the key is skipped.
 *
 * Keys present in `defaults` but missing from `input` retain their default value.
 * Null values in `input` are coerced to undefined.
 *
 * @param input The user-provided options (untyped).
 * @param validatorMap A map of option names to their validators.
 * @param defaults Default values for each option.
 * @param logger Logger for validation warnings.
 * @param prefix Optional prefix for option names in warning messages (e.g. "dataSystem").
 * @returns A validated options object merged over defaults.
 */
export default function validateOptions(
  input: Record<string, unknown>,
  validatorMap: Record<string, TypeValidator>,
  defaults: Record<string, unknown>,
  logger?: LDLogger,
  prefix?: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...defaults };

  Object.entries(input).forEach(([key, value]) => {
    const validator = validatorMap[key];
    const name = prefix ? `${prefix}.${key}` : key;

    if (!validator) {
      logger?.warn(OptionMessages.unknownOption(name));
      return;
    }

    if (isNullish(value)) {
      // Null/undefined: keep default
      return;
    }

    if (validator.is(value)) {
      result[key] = value;
      return;
    }

    // Validation failed — apply correction or fall back to default.
    const validatorType = validator.getType();

    if (validatorType === 'boolean') {
      logger?.warn(OptionMessages.wrongOptionTypeBoolean(name, typeof value));
      result[key] = !!value;
    } else if (validatorType === 'boolean | undefined | null') {
      logger?.warn(OptionMessages.wrongOptionTypeBoolean(name, typeof value));
      if (typeof value !== 'boolean' && typeof value !== 'undefined' && value !== null) {
        result[key] = !!value;
      }
    } else if (validator instanceof NumberWithMinimum && TypeValidators.Number.is(value)) {
      logger?.warn(OptionMessages.optionBelowMinimum(name, value, validator.min));
      result[key] = validator.min;
    } else {
      logger?.warn(OptionMessages.wrongOptionType(name, validatorType, typeof value));
      // result[key] keeps the default
    }
  });

  return result;
}
