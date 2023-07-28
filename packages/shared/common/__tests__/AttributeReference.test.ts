import { LDContextCommon } from '../src';
import AttributeReference from '../src/AttributeReference';

function AsContextCommon(values: Record<string, any>): LDContextCommon {
  return {
    ...values,
    key: 'potato',
  };
}

describe.each([
  new AttributeReference('/'),
  new AttributeReference(''),
  new AttributeReference('//'),
  new AttributeReference(''),
  new AttributeReference('', true),
  new AttributeReference('_meta'),
  new AttributeReference('/_meta'),
])('when given invalid attribute references', (reference) => {
  it('should not be valid', () => {
    expect(reference.isValid).toBeFalsy();
  });

  it('should not be able to get a value', () => {
    expect(
      reference.get(
        AsContextCommon({
          '/': true,
          '//': true,
          '/~3': true,
          '': true,
          _meta: {},
        }),
      ),
    ).toBeUndefined();
  });
});

describe.each([
  [new AttributeReference('/', true), { '/': true }, true],
  [new AttributeReference('//', true), { '//': 17 }, 17],
  [new AttributeReference('/~0', true), { '/~0': 'string' }, 'string'],
  [new AttributeReference('a~b', true), { 'a~b': 'another' }, 'another'],
  [new AttributeReference('a~b'), { 'a~b': 'another' }, 'another'],
  [new AttributeReference('a/b', true), { 'a/b': true }, true],
  [new AttributeReference('a/b'), { 'a/b': true }, true],
  [new AttributeReference('/a~1~0b'), { 'a/~b': true }, true],
  [new AttributeReference('/a~0b'), { 'a~b': true }, true],
  [new AttributeReference(' /a/b', true), { ' /a/b': true }, true],
  [new AttributeReference(' /a/b', false), { ' /a/b': true }, true],
  [new AttributeReference('/a/b'), { a: { b: 'c' } }, 'c'],
])('when given valid attribute references', (reference, object, expected) => {
  it('should be valid', () => {
    expect(reference.isValid).toBeTruthy();
  });

  it('should be able to get a value', () => {
    expect(reference.get(AsContextCommon(object))).toEqual(expected);
  });
});

describe.each([
  [new AttributeReference('name'), {}],
  [new AttributeReference('/a/b'), { a: {} }],
  [new AttributeReference('/a/0'), { a: 'test' }],
  [new AttributeReference('/a/b'), { a: null }],
  [new AttributeReference('/a/7'), { a: [0, 1] }],
])('should gracefully handle values that do not exist', (reference, object) => {
  it('should be valid', () => {
    expect(reference.isValid).toBeTruthy();
  });

  it('should not be able to get a value', () => {
    expect(reference.get(AsContextCommon(object))).toBeUndefined();
  });
});

it('should not allow indexing an array', () => {
  expect(
    new AttributeReference('/foo/0').get(AsContextCommon({ foo: ['bar', 'baz'] })),
  ).toBeUndefined();
});
