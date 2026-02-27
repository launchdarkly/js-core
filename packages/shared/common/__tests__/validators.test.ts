import { TypeArray, TypeValidators } from '../src';

const stringValue = 'this is a string';
const numberValue = 3.14159;
const objectValue = { yes: 'no' };
const functionValue = () => ({});
const stringArrayValue = ['these', 'are', 'strings'];
const booleanValue = true;

const allValues = [
  stringValue,
  numberValue,
  objectValue,
  functionValue,
  stringArrayValue,
  booleanValue,
];

function without(array: Array<any>, value: any): Array<any> {
  const returnArray = [...array];
  const index = returnArray.indexOf(value);
  if (index > -1) {
    returnArray.splice(index, 1);
  }
  return returnArray;
}

const invalidForString = without(allValues, stringValue);
const invalidForNumber = without(allValues, numberValue);
const invalidForObject = without(allValues, objectValue);
const invalidForFactory = without(invalidForObject, functionValue);
const invalidForStringArray = without(allValues, stringArrayValue);
const invalidForBoolean = without(allValues, booleanValue);

describe.each([
  [TypeValidators.String, [stringValue], invalidForString],
  [TypeValidators.Number, [numberValue], invalidForNumber],
  [TypeValidators.ObjectOrFactory, [objectValue, functionValue], invalidForFactory],
  [TypeValidators.Object, [objectValue], invalidForObject],
  [TypeValidators.StringArray, [stringArrayValue], invalidForStringArray],
  [TypeValidators.Boolean, [booleanValue], invalidForBoolean],
])(
  'Given a validator, valid values, and invalid values',
  (validator, validValues, invalidValues) => {
    it(`validates the correct type ${validator.getType()}: ${validValues}`, () => {
      validValues.forEach((validValue) => {
        expect(validator.is(validValue)).toBeTruthy();
      });
    });

    it(`does not validate incorrect types ${validator.getType()}: ${invalidValues}`, () => {
      invalidValues.forEach((invalidValue) => {
        expect(validator.is(invalidValue)).toBeFalsy();
      });
    });
  },
);

describe.each([
  [TypeValidators.StringArray, [['a', 'b', 'c', 'd'], []], [[0, 'potato'], [{}]]],
  [new TypeArray<number>('number[]', 0), [[0, 1, 2, 3], []], [[0, 'potato'], [{}]]],
  [
    new TypeArray<object>('object[]', {}),
    [[{}, { yes: 'no' }], []],
    [
      [0, 'potato'],
      [{}, 17],
    ],
  ],
])(
  'given an array validator, valid arrays, and invalid arrays',
  (validator, validValues, invalidValues) => {
    it(`validates the correct type ${validator.getType()}: ${validValues}`, () => {
      validValues.forEach((validValue) => {
        expect(validator.is(validValue)).toBeTruthy();
      });
    });

    it(`does not validate incorrect types ${validator.getType()}: ${invalidValues}`, () => {
      invalidValues.forEach((invalidValue) => {
        expect(validator.is(invalidValue)).toBeFalsy();
      });
    });
  },
);

describe('given a regex validator', () => {
  const validator = TypeValidators.stringMatchingRegex(/^(\w|\.|-)+$/);
  it('matches valid instances', () => {
    expect(validator.is('valid-version._')).toBeTruthy();
  });

  it('does not match invalid instances', () => {
    expect(validator.is('invalid-version!@#$%^&*()')).toBeFalsy();
  });
});

describe.each([
  [TypeValidators.numberWithMin(0), 0],
  [TypeValidators.numberWithMin(10), 10],
  [TypeValidators.numberWithMin(1000), 1000],
])('given minumum number validators', (validator, min) => {
  it('validates numbers equal or above the minimum', () => {
    expect(validator.is(min)).toBeTruthy();
    expect(validator.is(min + 1)).toBeTruthy();
  });

  it('does not validate numbers less than the minimum', () => {
    expect(validator.is(min - 1)).toBeFalsy();
  });
});

describe('given a oneOf validator', () => {
  const validator = TypeValidators.oneOf('streaming', 'polling', 'offline');

  it('accepts values in the allowed set', () => {
    expect(validator.is('streaming')).toBeTruthy();
    expect(validator.is('polling')).toBeTruthy();
    expect(validator.is('offline')).toBeTruthy();
  });

  it('rejects values not in the allowed set', () => {
    expect(validator.is('turbo')).toBeFalsy();
    expect(validator.is('')).toBeFalsy();
    expect(validator.is('STREAMING')).toBeFalsy();
  });

  it('rejects non-string values', () => {
    expect(validator.is(42)).toBeFalsy();
    expect(validator.is(true)).toBeFalsy();
    expect(validator.is(null)).toBeFalsy();
    expect(validator.is(undefined)).toBeFalsy();
    expect(validator.is({})).toBeFalsy();
  });

  it('reports the type as the allowed values joined by pipes', () => {
    expect(validator.getType()).toBe('streaming | polling | offline');
  });
});
