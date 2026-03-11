import { toCamelCase } from '../../../src/client/deprecated-hooks/flagKeyUtils';

it('converts kebab-case to camelCase', () => {
  expect(toCamelCase('my-flag-key')).toBe('myFlagKey');
});

it('converts snake_case to camelCase', () => {
  expect(toCamelCase('my_flag_key')).toBe('myFlagKey');
});

it('converts dot.separated to camelCase', () => {
  expect(toCamelCase('my.flag.key')).toBe('myFlagKey');
});

it('lowercases ALL_CAPS first word', () => {
  expect(toCamelCase('MY_FLAG')).toBe('myFlag');
});

it('preserves already-camelCase keys', () => {
  expect(toCamelCase('myFlagKey')).toBe('myFlagKey');
});

it('handles HTMLParser (ALLCAPS boundary)', () => {
  expect(toCamelCase('HTMLParser')).toBe('htmlParser');
});

it('handles a single word with no separators', () => {
  expect(toCamelCase('flag')).toBe('flag');
});

it('handles runs of multiple separators', () => {
  expect(toCamelCase('my--flag')).toBe('myFlag');
  expect(toCamelCase('my_.flag')).toBe('myFlag');
});

it('handles empty string', () => {
  expect(toCamelCase('')).toBe('');
});
