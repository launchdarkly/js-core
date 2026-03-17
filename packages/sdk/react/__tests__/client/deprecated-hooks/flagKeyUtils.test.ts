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

// ─── Already camelCase (idempotency) ──────────────────────────────────────────

it('preserves multi-hump camelCase', () => {
  expect(toCamelCase('myBigFlagKey')).toBe('myBigFlagKey');
});

it('preserves short camelCase', () => {
  expect(toCamelCase('xFlag')).toBe('xFlag');
});

// ─── All caps ─────────────────────────────────────────────────────────────────

it('lowercases a single all-caps word with no separators', () => {
  expect(toCamelCase('ALLFLAG')).toBe('allflag');
});

it('handles multi-word ALL_CAPS', () => {
  expect(toCamelCase('ALL_CAPS_FLAG')).toBe('allCapsFlag');
});

it('lowercases short all-caps abbreviations', () => {
  expect(toCamelCase('URL')).toBe('url');
  expect(toCamelCase('API')).toBe('api');
});

it('returns an all-lowercase word with no separators unchanged', () => {
  expect(toCamelCase('flagkey')).toBe('flagkey');
});

it('converts PascalCase to camelCase', () => {
  expect(toCamelCase('MyFlagKey')).toBe('myFlagKey');
});

// NOTE: This case should never happen as LaunchDarkly should handle invalid
// characters already.
it('preserves special characters that are not separators', () => {
  expect(toCamelCase('my@flag')).toBe('my@flag');
  expect(toCamelCase('my#flag!')).toBe('my#flag!');
  expect(toCamelCase('flag$key')).toBe('flag$key');
  expect(toCamelCase('my+flag')).toBe('my+flag');
});

it('keeps digits within a word token', () => {
  expect(toCamelCase('flag2value')).toBe('flag2value');
});

it('camelCases around digit-only segments separated by dashes', () => {
  expect(toCamelCase('my-flag-123')).toBe('myFlag123');
  expect(toCamelCase('flag-2-value')).toBe('flag2Value');
});

it('handles a leading digit segment', () => {
  expect(toCamelCase('123-flag')).toBe('123Flag');
});

it('preserves digits adjacent to camelCase boundaries', () => {
  expect(toCamelCase('my2ndFlag')).toBe('my2ndFlag');
});

// NOTE: This case should never happen as LaunchDarkly should handle invalid
// characters already.
it('ignores a leading separator', () => {
  expect(toCamelCase('-my-flag')).toBe('myFlag');
});

it('ignores a trailing separator', () => {
  expect(toCamelCase('my-flag-')).toBe('myFlag');
});

it('ignores leading and trailing separators together', () => {
  expect(toCamelCase('.my.flag.')).toBe('myFlag');
});

it('handles mixed separator types in one key', () => {
  expect(toCamelCase('my-flag_key.value')).toBe('myFlagKeyValue');
});

it('returns a single lowercase character unchanged', () => {
  expect(toCamelCase('a')).toBe('a');
});

it('lowercases a single uppercase character', () => {
  expect(toCamelCase('A')).toBe('a');
});
