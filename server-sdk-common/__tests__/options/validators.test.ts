import TypeValidators from '../../src/options/validators';

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
    it('validates the correct type', () => {
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
