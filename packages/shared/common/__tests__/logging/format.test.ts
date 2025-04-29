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
