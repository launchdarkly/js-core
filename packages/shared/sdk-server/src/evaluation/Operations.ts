import { parse, SemVer } from 'semver';

import { TypeValidator, TypeValidators } from '@launchdarkly/js-sdk-common';

const VERSION_COMPONENTS_REGEX = /^\d+(\.\d+)?(\.\d+)?/;

function parseSemver(input: any): SemVer | null {
  // A leading 'v' is not supported by the standard, but may be by the semver library.
  if (TypeValidators.String.is(input) && !input.startsWith('v')) {
    // If the input is able to be parsed, then return that.
    const parsed = parse(input);
    if (parsed) {
      return parsed;
    }
    // If not, then we are going to make some exceptions to the format.
    // Specifically semver requires 3 components, but we allow versions with
    // less. For instance we allow '1' to be equivalent to '1.0.0'.
    const components = VERSION_COMPONENTS_REGEX.exec(input);
    if (components) {
      let transformed = components[0];
      // Start after the match.
      for (let i = 1; i < components.length; i += 1) {
        // The regex will return a match followed by each group.
        // Unmatched groups are 'undefined'.
        // So we will always have 3 entries, the match and 2 groups.
        // For each missing group we need to append a '.0' until we have the
        // standard 3.
        if (components[i] === undefined) {
          transformed += '.0';
        }
      }
      // If the original version contains pre-release  information like '-beta.1',
      // then this will re-incorporate that into the string.
      transformed += input.substring(components[0].length);
      return parse(transformed);
    }
  }
  return null;
}

type OperatorFn<T> = (a: T, b: T) => boolean;

function semVerOperator(fn: OperatorFn<SemVer>): OperatorFn<any> {
  return (a: any, b: any) => {
    const aVer = parseSemver(a);
    const bVer = parseSemver(b);
    return !!(aVer && bVer && fn(aVer, bVer));
  };
}

function makeOperator<T>(
  fn: OperatorFn<T>,
  validator: TypeValidator,
  converter?: (val: any) => T,
): OperatorFn<any> {
  return (a: any, b: any) => {
    if (validator.is(a) && validator.is(b)) {
      if (converter) {
        return fn(converter(a), converter(b));
      }
      return fn(a, b);
    }
    return false;
  };
}

function parseDate(input: string | number): number {
  // Before calling this function we know the value is a date in a number
  // or as a string.
  if (typeof input === 'number') {
    return input;
  }
  return Date.parse(input);
}

function safeRegexMatch(pattern: string, value: string) {
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return false;
  }
}

interface OperatorsInterface {
  [operator: string]: OperatorFn<any> | undefined;
}

const operators: OperatorsInterface = {
  in: (a, b) => a === b,
  endsWith: makeOperator<string>((a, b) => a.endsWith(b), TypeValidators.String),
  startsWith: makeOperator<string>((a, b) => a.startsWith(b), TypeValidators.String),
  matches: makeOperator<string>(
    (value, pattern) => safeRegexMatch(pattern, value),
    TypeValidators.String,
  ),
  contains: makeOperator<string>((a, b) => a.indexOf(b) > -1, TypeValidators.String),
  lessThan: makeOperator<number>((a, b) => a < b, TypeValidators.Number),
  lessThanOrEqual: makeOperator<number>((a, b) => a <= b, TypeValidators.Number),
  greaterThan: makeOperator<number>((a, b) => a > b, TypeValidators.Number),
  greaterThanOrEqual: makeOperator<number>((a, b) => a >= b, TypeValidators.Number),
  before: makeOperator<number>((a, b) => a < b, TypeValidators.Date, parseDate),
  after: makeOperator<number>((a, b) => a > b, TypeValidators.Date, parseDate),
  semVerEqual: semVerOperator((a, b) => a.compare(b) === 0),
  semVerLessThan: semVerOperator((a, b) => a.compare(b) < 0),
  semVerGreaterThan: semVerOperator((a, b) => a.compare(b) > 0),
};

/**
 * Allows checking if a specific operator is defined and allows execution of an operator on data.
 *
 * @internal
 */
export default class Operators {
  static is(op: string): boolean {
    return Object.prototype.hasOwnProperty.call(operators, op);
  }

  static execute(op: string, a: any, b: any): boolean {
    return operators[op]?.(a, b) ?? false;
  }
}
