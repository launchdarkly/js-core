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
 * (objects, arrays, or union types like boolean|object). Returns
 * the validated value on success, or undefined to preserve the default.
 */
interface CompoundValidator extends TypeValidator {
  validate(value: unknown, name: string, logger?: LDLogger): { value: unknown } | undefined;
}

function isCompoundValidator(v: TypeValidator): v is CompoundValidator {
  return 'validate' in v;
}

/**
 * Validates an options object against a map of validators and defaults.
 *
 * Supports special validator types created by:
 * - {@link validatorOf}: recursively validates nested objects
 * - {@link arrayOf}: validates arrays with per-item validation
 * - {@link booleanOrObjectOf}: accepts boolean or recursively validates objects
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
      return;
    }

    if (isCompoundValidator(validator)) {
      const validated = validator.validate(value, name, logger);
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
 */
export function validatorOf(validators: Record<string, TypeValidator>): CompoundValidator {
  return {
    is: (u: unknown) => TypeValidators.Object.is(u),
    getType: () => 'object',
    validate(value: unknown, name: string, logger?: LDLogger) {
      if (!TypeValidators.Object.is(value)) {
        logger?.warn(OptionMessages.wrongOptionType(name, 'object', typeof value));
        return undefined;
      }
      const nested = validateOptions(
        value as Record<string, unknown>,
        validators,
        {},
        logger,
        name,
      );
      return Object.keys(nested).length > 0 ? { value: nested } : undefined;
    },
  };
}

/**
 * Creates a validator for arrays of objects with per-item validation.
 * Invalid items are filtered out. Use `discriminant` and `validatorsByType`
 * to select different validators based on a field value (e.g. `type`).
 */
export function arrayOf(
  itemValidators: Record<string, TypeValidator>,
  discriminant?: string,
  validatorsByType?: Record<string, Record<string, TypeValidator>>,
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

        let validators = itemValidators;
        if (discriminant && validatorsByType) {
          const discriminantValidator = validators[discriminant];
          const typeValue = obj[discriminant];

          if (!discriminantValidator || !discriminantValidator.is(typeValue)) {
            const received =
              typeof typeValue === 'string' ? (typeValue as string) : typeof typeValue;
            logger?.warn(
              OptionMessages.wrongOptionType(
                `${itemPath}.${discriminant}`,
                discriminantValidator?.getType() ?? 'string',
                received,
              ),
            );
            return;
          }

          validators = validatorsByType[typeValue as string] ?? itemValidators;
        }

        results.push(validateOptions(obj, validators, {}, logger, itemPath));
      });

      return results.length > 0 ? { value: results } : undefined;
    },
  };
}

/**
 * Creates a validator that accepts either a boolean or a nested object.
 */
export function booleanOrObjectOf(validators: Record<string, TypeValidator>): CompoundValidator {
  return {
    is: (u: unknown) => TypeValidators.Boolean.is(u) || TypeValidators.Object.is(u),
    getType: () => 'boolean or object',
    validate(value: unknown, name: string, logger?: LDLogger) {
      if (TypeValidators.Boolean.is(value)) {
        return { value };
      }
      if (TypeValidators.Object.is(value)) {
        return {
          value: validateOptions(value as Record<string, unknown>, validators, {}, logger, name),
        };
      }
      logger?.warn(OptionMessages.wrongOptionType(name, 'boolean or object', typeof value));
      return undefined;
    },
  };
}
