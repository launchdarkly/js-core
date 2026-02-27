/* eslint-disable class-methods-use-this */
/* eslint-disable max-classes-per-file */

// The classes here are static, but needs to be instantiated to
// support the generic functionality. Which is why we do not care about using
// `this`

// These validators are also of trivial complexity, so we are allowing more than
// one per file.

/**
 * Interface for type validation.
 */
export interface TypeValidator {
  is(u: unknown): boolean;
  getType(): string;
}

/**
 * Validate a factory or instance.
 */
export class FactoryOrInstance implements TypeValidator {
  is(factoryOrInstance: unknown) {
    if (Array.isArray(factoryOrInstance)) {
      return false;
    }
    const anyFactory = factoryOrInstance as any;
    const typeOfFactory = typeof anyFactory;
    return typeOfFactory === 'function' || typeOfFactory === 'object';
  }

  getType(): string {
    return 'factory method or object';
  }
}

/**
 * Validate a basic type.
 */
export class Type<T> implements TypeValidator {
  private _typeName: string;

  protected typeOf: string;

  constructor(typeName: string, example: T) {
    this._typeName = typeName;
    this.typeOf = typeof example;
  }

  is(u: unknown): u is T {
    if (Array.isArray(u)) {
      return false;
    }
    return typeof u === this.typeOf;
  }

  getType(): string {
    return this._typeName;
  }
}

/**
 * Validate an array of the specified type.
 *
 * This does not validate instances of types. All class instances
 * of classes will simply objects.
 */
export class TypeArray<T> implements TypeValidator {
  private _typeName: string;

  protected typeOf: string;

  constructor(typeName: string, example: T) {
    this._typeName = typeName;
    this.typeOf = typeof example;
  }

  is(u: unknown): u is T {
    if (Array.isArray(u)) {
      if (u.length > 0) {
        return u.every((val) => typeof val === this.typeOf);
      }
      return true;
    }
    return false;
  }

  getType(): string {
    return this._typeName;
  }
}

/**
 * Validate a value is a number and is greater or eval than a minimum.
 */
export class NumberWithMinimum extends Type<number> {
  readonly min: number;

  constructor(min: number) {
    super(`number with minimum value of ${min}`, 0);
    this.min = min;
  }

  override is(u: unknown): u is number {
    return typeof u === this.typeOf && (u as number) >= this.min;
  }
}

/**
 * Validate a value is a string and it matches the given expression.
 */
export class StringMatchingRegex extends Type<string> {
  readonly expression: RegExp;

  constructor(expression: RegExp) {
    super(`string matching ${expression}`, '');
    this.expression = expression;
  }

  override is(u: unknown): u is string {
    return typeof u === 'string' && !!(u as string).match(this.expression);
  }
}

/**
 * Validate a value is a function.
 */
export class Function implements TypeValidator {
  is(u: unknown): u is (...args: any[]) => void {
    // We cannot inspect the parameters and there isn't really
    // a generic function type we can instantiate.
    // So the type guard is here just to make TS comfortable
    // calling something after using this guard.
    return typeof u === 'function';
  }

  getType(): string {
    return 'function';
  }
}

export class NullableBoolean implements TypeValidator {
  is(u: unknown): boolean {
    return typeof u === 'boolean' || typeof u === 'undefined' || u === null;
  }

  getType(): string {
    return 'boolean | undefined | null';
  }
}

// Our reference SDK, Go, parses date/time strings with the time.RFC3339Nano format.
// This regex should match strings that are valid in that format, and no others.
// Acceptable:
//   2019-10-31T23:59:59Z, 2019-10-31T23:59:59.100Z,
//   2019-10-31T23:59:59-07, 2019-10-31T23:59:59-07:00, etc.
// Unacceptable: no "T", no time zone designation
const DATE_REGEX = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d\d*)?(Z|[-+]\d\d(:\d\d)?)/;

/**
 * Validate a value is a date. Values which are numbers are treated as dates and any string
 * which if compliant with `time.RFC3339Nano` is a date.
 */
export class DateValidator implements TypeValidator {
  is(u: unknown): boolean {
    return typeof u === 'number' || (typeof u === 'string' && DATE_REGEX.test(u));
  }

  getType(): string {
    return 'date';
  }
}

/**
 * Validates that a string is a valid kind.
 */
export class KindValidator extends StringMatchingRegex {
  constructor() {
    super(/^(\w|\.|-)+$/);
  }

  override is(u: unknown): u is string {
    return super.is(u) && u !== 'kind';
  }
}

/**
 * Validate a value is a string matching one of the allowed values.
 */
export class OneOf implements TypeValidator {
  private readonly _values: ReadonlyArray<string>;

  constructor(values: ReadonlyArray<string>) {
    this._values = values;
  }

  is(u: unknown): u is string {
    return typeof u === 'string' && this._values.includes(u);
  }

  getType(): string {
    return this._values.join(' | ');
  }
}

/**
 * Returns true if the value is null or undefined.
 */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * A set of standard type validators.
 */
export class TypeValidators {
  static readonly String = new Type<string>('string', '');

  static readonly Number = new Type<number>('number', 0);

  static readonly ObjectOrFactory = new FactoryOrInstance();

  static readonly Object = new Type<object>('object', {});

  static readonly StringArray = new TypeArray<string>('string[]', '');

  static readonly Boolean = new Type<boolean>('boolean', true);

  static readonly Function = new Function();

  static createTypeArray<T>(typeName: string, example: T) {
    return new TypeArray<T>(typeName, example);
  }

  static numberWithMin(min: number): NumberWithMinimum {
    return new NumberWithMinimum(min);
  }

  static stringMatchingRegex(expression: RegExp): StringMatchingRegex {
    return new StringMatchingRegex(expression);
  }

  static readonly Date = new DateValidator();

  static oneOf(...values: string[]): OneOf {
    return new OneOf(values);
  }

  static readonly Kind = new KindValidator();
  static readonly NullableBoolean = new NullableBoolean();
}
