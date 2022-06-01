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
  is(u:unknown): boolean;
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
  private typeName: string;

  protected typeOf: string;

  constructor(typeName: string, example: T) {
    this.typeName = typeName;
    this.typeOf = typeof example;
  }

  is(u: unknown): u is T {
    if (Array.isArray(u)) {
      return false;
    }
    return typeof u === this.typeOf;
  }

  getType(): string {
    return this.typeName;
  }
}

/**
 * Validate an array of the specified type.
 */
export class TypeArray<T> implements TypeValidator {
  private typeName: string;

  protected typeOf: string;

  constructor(typeName: string, example: T) {
    this.typeName = typeName;
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
    return this.typeName;
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
    return !!(u as string).match(this.expression);
  }
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

  static NumberWithMin(min: number): NumberWithMinimum {
    return new NumberWithMinimum(min);
  }

  static StringMatchingRegex(expression: RegExp): StringMatchingRegex {
    return new StringMatchingRegex(expression);
  }
}
