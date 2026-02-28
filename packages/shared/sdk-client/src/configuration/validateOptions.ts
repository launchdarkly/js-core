import {
  isNullish,
  LDLogger,
  NumberWithMinimum,
  OptionMessages,
  TypeValidator,
  TypeValidators,
} from '@launchdarkly/js-sdk-common';

/**
 * A validator that performs structured validation on compound values
 * (objects, arrays, records, or union types). Returns the validated value
 * on success, or undefined to preserve the default.
 *
 * @param defaults - The current default value for this field, passed from
 *   `validateOptions` so nested defaults propagate without hand-written wrappers.
 */
export interface CompoundValidator extends TypeValidator {
  validate(
    value: unknown,
    name: string,
    logger?: LDLogger,
    defaults?: unknown,
  ): { value: unknown } | undefined;
}

function isCompoundValidator(v: TypeValidator): v is CompoundValidator {
  return 'validate' in v;
}

/**
 * Validates an options object against a map of validators and defaults.
 *
 * If `input` is null, undefined, or not an object the defaults are returned
 * (with a warning for non-nullish non-objects).
 *
 * Supports special validator types created by:
 * - {@link validatorOf}: recursively validates nested objects
 * - {@link arrayOf}: validates arrays with per-item validation
 * - {@link anyOf}: accepts the first matching validator from a list
 * - {@link recordOf}: validates objects with dynamic keys
 */
export default function validateOptions(
  input: unknown,
  validatorMap: Record<string, TypeValidator>,
  defaults: Record<string, unknown>,
  logger?: LDLogger,
  prefix?: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...defaults };

  if (isNullish(input)) {
    return result;
  }

  if (!TypeValidators.Object.is(input)) {
    logger?.warn(OptionMessages.wrongOptionType(prefix ?? 'config', 'object', typeof input));
    return result;
  }

  Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
    const validator = validatorMap[key];
    const name = prefix ? `${prefix}.${key}` : key;

    if (!validator) {
      logger?.warn(OptionMessages.unknownOption(name));
      return;
    }

    if (isNullish(value)) {
      return;
    }

    if (isCompoundValidator(validator)) {
      const validated = validator.validate(value, name, logger, defaults[key]);
      if (validated !== undefined) {
        result[key] = validated.value;
      }
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
    }
  });

  return result;
}

/**
 * Creates a validator for nested objects. When used in a validator map,
 * `validateOptions` will recursively validate the nested object's properties.
 * Defaults for nested fields are passed through from the parent.
 */
export function validatorOf(validators: Record<string, TypeValidator>): CompoundValidator {
  return {
    is: (u: unknown) => TypeValidators.Object.is(u),
    getType: () => 'object',
    validate(value: unknown, name: string, logger?: LDLogger, defaults?: unknown) {
      if (!TypeValidators.Object.is(value)) {
        logger?.warn(OptionMessages.wrongOptionType(name, 'object', typeof value));
        return undefined;
      }
      const nestedDefaults = TypeValidators.Object.is(defaults)
        ? (defaults as Record<string, unknown>)
        : {};
      const nested = validateOptions(
        value as Record<string, unknown>,
        validators,
        nestedDefaults,
        logger,
        name,
      );
      return Object.keys(nested).length > 0 ? { value: nested } : undefined;
    },
  };
}

/**
 * Creates a validator for arrays of discriminated objects. Each item in the
 * array must be an object containing a `discriminant` field whose value
 * selects which validator map to apply. The valid discriminant values are
 * the keys of `validatorsByType`. Items that are not objects, or whose
 * discriminant value is missing or unrecognized, are filtered out with a
 * warning.
 *
 * @param discriminant - The field name used to determine each item's type.
 * @param validatorsByType - A mapping from discriminant values to the
 *   validator maps used to validate items of that type. Each validator map
 *   should include a validator for the discriminant field itself.
 *
 * @example
 * ```ts
 * // Validates an array like:
 * //   [{ type: 'polling', pollInterval: 60 }, { type: 'cache' }]
 *
 * const validator = arrayOf('type', {
 *   cache: { type: TypeValidators.String },
 *   polling: { type: TypeValidators.String, pollInterval: TypeValidators.numberWithMin(30) },
 *   streaming: { type: TypeValidators.String, initialReconnectDelay: TypeValidators.numberWithMin(1) },
 * });
 * ```
 */
export function arrayOf(
  discriminant: string,
  validatorsByType: Record<string, Record<string, TypeValidator>>,
): CompoundValidator {
  return {
    is: (u: unknown) => Array.isArray(u),
    getType: () => 'array',
    validate(value: unknown, name: string, logger?: LDLogger) {
      if (!Array.isArray(value)) {
        logger?.warn(OptionMessages.wrongOptionType(name, 'array', typeof value));
        return undefined;
      }

      const results: Record<string, unknown>[] = [];

      value.forEach((item, i) => {
        const itemPath = `${name}[${i}]`;

        if (isNullish(item) || !TypeValidators.Object.is(item)) {
          logger?.warn(OptionMessages.wrongOptionType(itemPath, 'object', typeof item));
          return;
        }

        const obj = item as Record<string, unknown>;
        const typeValue = obj[discriminant];
        const validators = typeof typeValue === 'string' ? validatorsByType[typeValue] : undefined;

        if (!validators) {
          const expected = Object.keys(validatorsByType).join(' | ');
          const received = typeof typeValue === 'string' ? typeValue : typeof typeValue;
          logger?.warn(
            OptionMessages.wrongOptionType(`${itemPath}.${discriminant}`, expected, received),
          );
          return;
        }

        results.push(validateOptions(obj, validators, {}, logger, itemPath));
      });

      return { value: results };
    },
  };
}

/**
 * Creates a validator that tries each provided validator in order and uses the
 * first one whose `is()` check passes. For compound validators the value is
 * processed through `validate()`; for simple validators the value is accepted
 * as-is. If no validator matches, a warning is logged and the default is
 * preserved.
 *
 * @example
 * ```ts
 * // Accepts either a boolean or a nested object with specific fields:
 * anyOf(TypeValidators.Boolean, validatorOf({ lifecycle: TypeValidators.Boolean }))
 * ```
 */
export function anyOf(...validators: TypeValidator[]): CompoundValidator {
  return {
    is: (u: unknown) => validators.some((v) => v.is(u)),
    getType: () => validators.map((v) => v.getType()).join(' | '),
    validate(value: unknown, name: string, logger?: LDLogger, defaults?: unknown) {
      const match = validators.find((v) => v.is(value));
      if (match) {
        return isCompoundValidator(match)
          ? match.validate(value, name, logger, defaults)
          : { value };
      }
      logger?.warn(OptionMessages.wrongOptionType(name, this.getType(), typeof value));
      return undefined;
    },
  };
}

/**
 * Creates a validator for objects with dynamic keys. Each key in the input
 * object is checked against `keyValidator`; unrecognized keys produce a
 * warning. Each value is validated by `valueValidator`. Defaults for
 * individual entries are passed through from the parent so partial overrides
 * preserve non-overridden entries.
 *
 * @param keyValidator - Validates that each key is an allowed value.
 * @param valueValidator - Validates each value in the record.
 *
 * @example
 * ```ts
 * // Validates a record like { streaming: { ... }, polling: { ... } }
 * // where keys must be valid connection modes:
 * recordOf(
 *   TypeValidators.oneOf('streaming', 'polling', 'offline'),
 *   validatorOf({ initializers: arrayValidator, synchronizers: arrayValidator }),
 * )
 * ```
 */
export function recordOf(
  keyValidator: TypeValidator,
  valueValidator: TypeValidator,
): CompoundValidator {
  return {
    is: (u: unknown) => TypeValidators.Object.is(u),
    getType: () => 'object',
    validate(value: unknown, name: string, logger?: LDLogger, defaults?: unknown) {
      if (isNullish(value)) {
        return undefined;
      }

      if (!TypeValidators.Object.is(value)) {
        logger?.warn(OptionMessages.wrongOptionType(name, 'object', typeof value));
        return undefined;
      }

      // Filter invalid keys, then delegate to validateOptions.
      const obj = value as Record<string, unknown>;
      const filtered: Record<string, unknown> = {};
      const validatorMap: Record<string, TypeValidator> = {};

      Object.keys(obj).forEach((key) => {
        if (keyValidator.is(key)) {
          filtered[key] = obj[key];
          validatorMap[key] = valueValidator;
        } else {
          logger?.warn(OptionMessages.wrongOptionType(name, keyValidator.getType(), key));
        }
      });

      const recordDefaults = TypeValidators.Object.is(defaults)
        ? (defaults as Record<string, unknown>)
        : {};
      return { value: validateOptions(filtered, validatorMap, recordDefaults, logger, name) };
    },
  };
}
