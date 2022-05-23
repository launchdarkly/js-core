/* eslint-disable class-methods-use-this */
/* eslint-disable max-classes-per-file */

// The classes here are static, but needs to be instantiated to
// support the generic functionality. Which is why we do not care about using
// `this`

// These validators are also of trivial complexity, so we are allowing more than
// one per file.

/**
 * Interface for type validation.
 *
 * @internal
 */
export interface TypeValidator {
  is(u:unknown): boolean;
  getType(): string;
}

/**
 * Validate a factory or instance.
 *
 * @internal
 */
export class FactoryOrInstance implements TypeValidator {
  is(factoryOrInstance: unknown) {
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
 *
 * @internal
 */
export class Type<T> implements TypeValidator {
  private typeName: string;

  constructor(typeName: string) {
    this.typeName = typeName;
  }

  // eslint-disable-next-line class-methods-use-this
  is(u: unknown): u is T {
    return true;
  }

  getType(): string {
    return this.typeName;
  }
}

/**
 * Validate a value is a number and is greater or eval than a minimum.
 *
 * @internal
 */
export class NumberWithMinimum extends Type<number> {
  readonly min: number;

  constructor(min: number) {
    super(`number with minimum value of ${min}`);
    this.min = min;
  }

  override is(u: unknown): u is number {
    return (u as number) >= this.min;
  }
}

/**
 * Validate a value is a string and it matches the given expression.
 *
 * @internal
 */
export class StringMatchingRegex extends Type<string> {
  readonly expression: RegExp;

  constructor(expression: RegExp) {
    super(`string matching ${expression}`);
    this.expression = expression;
  }

  override is(u: unknown): u is string {
    return !!(u as string).match(this.expression);
  }
}

/**
 * A set of standard type validators.
 *
 * @internal
 */
export default class TypeValidators {
  static readonly String = new Type<string>('string');

  static readonly Number = new Type<number>('number');

  static readonly ObjectOrFactory = new FactoryOrInstance();

  static readonly Object = new Type<object>('object');

  static readonly StringArray = new Type<Array<string>>('string[]');

  static readonly Boolean = new Type<boolean>('boolean');

  static NumberWithMin(min: number): NumberWithMinimum {
    return new NumberWithMinimum(min);
  }

  static StringMatchingRegex(expression: RegExp): StringMatchingRegex {
    return new StringMatchingRegex(expression);
  }
}
