import {
  isNullish,
  LDLogger,
  NumberWithMinimum,
  OptionMessages,
  TypeValidator,
  TypeValidators,
} from '@launchdarkly/js-sdk-common';

interface NestedValidator extends TypeValidator {
  kind: 'nested';
  validators: Record<string, TypeValidator>;
}

interface ArrayValidator extends TypeValidator {
  kind: 'array';
  validate(value: unknown[], prefix: string, logger?: LDLogger): Record<string, unknown>[];
}

interface BooleanOrNestedValidator extends TypeValidator {
  kind: 'booleanOrNested';
  validators: Record<string, TypeValidator>;
}

/**
 * Creates a validator for nested objects. When used in a validator map,
 * `validateOptions` will recursively validate the nested object's properties.
 */
export function validatorOf(validators: Record<string, TypeValidator>): NestedValidator {
  return {
    kind: 'nested',
    validators,
    is: (u: unknown) => TypeValidators.Object.is(u),
    getType: () => 'object',
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
): ArrayValidator {
  return {
    kind: 'array',
    is: (u: unknown) => Array.isArray(u),
    getType: () => 'array',
    validate(value: unknown[], prefix: string, logger?: LDLogger): Record<string, unknown>[] {
      const results: Record<string, unknown>[] = [];

      value.forEach((item, i) => {
        const itemPath = `${prefix}[${i}]`;

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

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        results.push(validateOptions(obj, validators, {}, logger, itemPath));
      });

      return results;
    },
  };
}

/**
 * Creates a validator that accepts either a boolean or a nested object.
 */
export function booleanOrObjectOf(
  validators: Record<string, TypeValidator>,
): BooleanOrNestedValidator {
  return {
    kind: 'booleanOrNested',
    validators,
    is: (u: unknown) => TypeValidators.Boolean.is(u) || TypeValidators.Object.is(u),
    getType: () => 'boolean or object',
  };
}

function isNestedValidator(v: TypeValidator): v is NestedValidator {
  return (v as any).kind === 'nested';
}

function isArrayValidator(v: TypeValidator): v is ArrayValidator {
  return (v as any).kind === 'array';
}

function isBooleanOrNestedValidator(v: TypeValidator): v is BooleanOrNestedValidator {
  return (v as any).kind === 'booleanOrNested';
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

    if (isNestedValidator(validator)) {
      if (TypeValidators.Object.is(value)) {
        const nested = validateOptions(
          value as Record<string, unknown>,
          validator.validators,
          {},
          logger,
          name,
        );
        if (Object.keys(nested).length > 0) {
          result[key] = nested;
        }
      } else {
        logger?.warn(OptionMessages.wrongOptionType(name, 'object', typeof value));
      }
      return;
    }

    if (isArrayValidator(validator)) {
      if (Array.isArray(value)) {
        const items = validator.validate(value, name, logger);
        if (items.length > 0) {
          result[key] = items;
        }
      } else {
        logger?.warn(OptionMessages.wrongOptionType(name, 'array', typeof value));
      }
      return;
    }

    if (isBooleanOrNestedValidator(validator)) {
      if (TypeValidators.Boolean.is(value)) {
        result[key] = value;
      } else if (TypeValidators.Object.is(value)) {
        result[key] = validateOptions(
          value as Record<string, unknown>,
          validator.validators,
          {},
          logger,
          name,
        );
      } else {
        logger?.warn(OptionMessages.wrongOptionType(name, validator.getType(), typeof value));
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
