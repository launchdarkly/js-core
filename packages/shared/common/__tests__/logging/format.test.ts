import format from '../../src/logging/format';

// For circular reference test.
const circular: any = {};
circular.circular = circular;

describe.each([
  ['', [], ''],
  ['the', ['end'], 'the end'],
  ['%s', [], '%s'],
  ['%s', [1], '1'],
  ['The best %s', [{ apple: 'pie' }], 'The best {"apple":"pie"}'],
  ['The best %o', [{ apple: 'pie' }], 'The best {"apple":"pie"}'],
  ['The best %O', [{ apple: 'pie' }], 'The best {"apple":"pie"}'],
  ['%o', [17], '17'],
  ['%O', [17], '17'],
  ['', [{ apple: 'pie' }, 7, 12], '{"apple":"pie"} 7 12'],
  ['%s', [BigInt(1)], '1n'],
  ['%d', [BigInt(1)], '1n'],
  ['%i', [BigInt(1)], '1n'],
  ['%f', [BigInt(1)], '1'],
  ['%i', [3.14159], '3'],
  ['%i %d', [3.14159], '3 %d'],
  ['', [1, 2, 3, 4], '1 2 3 4'],
  ['%s %d %f', [1, 2, 3, 4], '1 2 3 4'],
  ['%s %d %f ', [1, 2, 3, 4], '1 2 3  4'],
  ['%s %j', [circular, circular], '[Circular] [Circular]'],
  ['%d', [Symbol('foo')], 'NaN'],
  ['%i', [Symbol('foo')], 'NaN'],
  ['%f', [Symbol('foo')], 'NaN'],
  ['%%', [], '%'],
  ['%', [], '%'],
  ['100%', [], '100%'],
  ['100%', [1], '100% 1'],
  ['%s %', ['a'], 'a %'],
  [
    '',
    [Symbol('foo'), circular, BigInt(7), { apple: 'pie' }, global, undefined, null],
    /\[Circular\] 7n {"apple":"pie"} \[.*\] undefined null/,
  ],
])('given node style format strings', (formatStr, args, result) => {
  it('produces the expected string', () => {
    expect(format(formatStr, ...args)).toMatch(result);
  });
});

it.each<[any[], string]>([
  [[42], '42'],
  [[0, false, null, undefined], '0 false null undefined'],
  [[true], 'true'],
  [[false], 'false'],
  [[null], 'null'],
  [[undefined], 'undefined'],
  [[{ apple: 'pie' }, 7], '{"apple":"pie"} 7'],
  [[BigInt(1)], '1n'],
  [[circular], '[Circular]'],
  [[[1, 2], 3], '[1,2] 3'],
  [[42, '%s', 'value'], '42 %s value'],
])('keeps all arguments when the first is not a string: %p', (args, expected) => {
  expect(format(...args)).toBe(expected);
});

it('formats no arguments as an empty string', () => {
  expect(format()).toBe('');
});
