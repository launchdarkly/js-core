/* eslint-disable class-methods-use-this */
/* eslint-disable max-classes-per-file */

export interface TypeValidator {
  is(u:unknown): boolean;
  getType(): string;
}

class FactoryOrInstance implements TypeValidator {
  is(factoryOrInstance: unknown) {
    const anyFactory = factoryOrInstance as any;
    const typeOfFactory = typeof anyFactory;
    return typeOfFactory === 'function' || typeOfFactory === 'object';
  }

  getType(): string {
    return 'factory method or object';
  }
}

class Type<T> implements TypeValidator {
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

export default class TypeValidators {
  static readonly String = new Type<string>('string');

  static readonly Number = new Type<number>('number');

  static readonly ObjectOrFactory = new FactoryOrInstance();

  static readonly Object = new Type<object>('object');

  static readonly StringArray = new Type<Array<string>>('string[]');

  static readonly Boolean = new Type<boolean>('boolean');
}
