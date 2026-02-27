/* eslint-disable max-classes-per-file */
import {
  isNullish,
  LDLogger,
  NumberWithMinimum,
  OptionMessages,
  TypeValidator,
  TypeValidators,
} from '@launchdarkly/js-sdk-common';

/**
 * A validator that accepts objects and recursively validates their properties
 * against a nested validator map. Use {@link validatorOf} to create one.
 */
export class NestedValidator implements TypeValidator {
  constructor(readonly validators: Record<string, TypeValidator>) {}

  is(u: unknown): boolean {
    return TypeValidators.Object.is(u);
  }

  getType(): string {
    return 'object';
  }
}

/**
 * A validator for arrays of objects. Each item is validated individually;
 * invalid items are filtered out rather than causing the whole array to fail.
 *
 * When `discriminant` and `validatorsByType` are provided, the validator map
 * for each item is selected based on the value of the discriminant field.
 */
export class ArrayValidator implements TypeValidator {
  constructor(
    private readonly _itemValidators: Record<string, TypeValidator>,
    private readonly _discriminant?: string,
    private readonly _validatorsByType?: Record<string, Record<string, TypeValidator>>,
  ) {}

  is(u: unknown): boolean {
    return Array.isArray(u);
  }

  getType(): string {
    return 'array';
  }

  validate(value: unknown[], prefix: string, logger?: LDLogger): Record<string, unknown>[] {
    const results: Record<string, unknown>[] = [];

    value.forEach((item, i) => {
      const itemPath = `${prefix}[${i}]`;

      if (isNullish(item) || !TypeValidators.Object.is(item)) {
        logger?.warn(OptionMessages.wrongOptionType(itemPath, 'object', typeof item));
        return;
      }

      const obj = item as Record<string, unknown>;

      // Select validators based on discriminant if configured.
      let validators = this._itemValidators;
      if (this._discriminant && this._validatorsByType) {
        const discriminantValidator = validators[this._discriminant];
        const typeValue = obj[this._discriminant];

        if (!discriminantValidator || !discriminantValidator.is(typeValue)) {
          const received = typeof typeValue === 'string' ? (typeValue as string) : typeof typeValue;
          logger?.warn(
            OptionMessages.wrongOptionType(
              `${itemPath}.${this._discriminant}`,
              discriminantValidator?.getType() ?? 'string',
              received,
            ),
          );
          return;
        }

        validators = this._validatorsByType[typeValue as string] ?? this._itemValidators;
      }

      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      results.push(validateOptions(obj, validators, {}, logger, itemPath));
    });

    return results;
  }
}

/**
 * A validator that accepts either a boolean or a nested object.
 * When the value is an object, its properties are validated against the
 * provided validator map.
 */
export class BooleanOrNestedValidator implements TypeValidator {
  constructor(readonly validators: Record<string, TypeValidator>) {}

  is(u: unknown): boolean {
    return TypeValidators.Boolean.is(u) || TypeValidators.Object.is(u);
  }

  getType(): string {
    return 'boolean or object';
  }
}

/**
 * Creates a validator for nested objects. When used in a validator map,
 * `validateOptions` will recursively validate the nested object's properties.
 */
export function validatorOf(validators: Record<string, TypeValidator>): NestedValidator {
  return new NestedValidator(validators);
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
  return new ArrayValidator(itemValidators, discriminant, validatorsByType);
}

/**
 * Creates a validator that accepts either a boolean or a nested object.
 */
export function booleanOrObjectOf(
  validators: Record<string, TypeValidator>,
): BooleanOrNestedValidator {
  return new BooleanOrNestedValidator(validators);
}

/**
 * Validates an options object against a map of validators and defaults.
 *
 * Supports special validator types:
 * - {@link NestedValidator}: recursively validates nested objects
 * - {@link ArrayValidator}: validates arrays with per-item validation
 * - {@link BooleanOrNestedValidator}: accepts boolean or recursively validates objects
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

    // Nested object validators.
    if (validator instanceof NestedValidator) {
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

    // Array validators.
    if (validator instanceof ArrayValidator) {
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

    // Boolean-or-object validators.
    if (validator instanceof BooleanOrNestedValidator) {
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

    // Standard validators.
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
