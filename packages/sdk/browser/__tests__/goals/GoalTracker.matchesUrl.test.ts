import { Matcher } from '../../src/goals/Goals';
import { matchesUrl } from '../../src/goals/GoalTracker';

it.each([
  ['https://example.com', '', '', 'https://example.com'],
  [
    'https://example.com?potato=true#hash',
    '?potato=true',
    '#hash',
    'https://example.com?potato=true#hash',
  ],
])('returns true for exact match with "exact" matcher kind', (href, query, hash, matcherUrl) => {
  const matcher: Matcher = { kind: 'exact', url: matcherUrl };
  const result = matchesUrl(matcher, href, query, hash);
  expect(result).toBe(true);
});

it.each([
  ['https://example.com/potato', '', '', 'https://example.com'],
  [
    'https://example.com?potato=true#hash',
    '?potato=true',
    '#hash',
    'https://example.com?potato=true#brown',
  ],
])('returns false for non-matching "exact" matcher kind', (href, query, hash, matcherUrl) => {
  const matcher: Matcher = { kind: 'exact', url: matcherUrl };
  const result = matchesUrl(matcher, href, query, hash);
  expect(result).toBe(false);
});

it('returns true for canonical match with "canonical" matcher kind', () => {
  // For this type of match the hash and query parameters are not included.
  const matcher: Matcher = { kind: 'canonical', url: 'https://example.com/some-path' };
  const result = matchesUrl(
    matcher,
    'https://example.com/some-path?query=1#hash',
    '?query=1',
    '#hash',
  );
  expect(result).toBe(true);
});

it('returns true for substring match with "substring" matcher kind', () => {
  const matcher: Matcher = { kind: 'substring', substring: 'example' };
  const result = matchesUrl(
    matcher,
    'https://example.com/some-path?query=1#hash',
    '?query=1',
    '#hash',
  );
  expect(result).toBe(true);
});

it('returns false for non-matching substring with "substring" matcher kind', () => {
  const matcher: Matcher = { kind: 'substring', substring: 'nonexistent' };
  const result = matchesUrl(
    matcher,
    'https://example.com/some-path?query=1#hash',
    '?query=1',
    '#hash',
  );
  expect(result).toBe(false);
});

it('returns true for regex match with "regex" matcher kind', () => {
  const matcher: Matcher = { kind: 'regex', pattern: 'example\\.com' };
  const result = matchesUrl(
    matcher,
    'https://example.com/some-path?query=1#hash',
    '?query=1',
    '#hash',
  );
  expect(result).toBe(true);
});

it('returns false for non-matching regex with "regex" matcher kind', () => {
  const matcher: Matcher = { kind: 'regex', pattern: 'nonexistent\\.com' };
  const result = matchesUrl(
    matcher,
    'https://example.com/some-path?query=1#hash',
    '?query=1',
    '#hash',
  );
  expect(result).toBe(false);
});

it('includes the hash for "path-like" hashes for "substring" matchers', () => {
  const matcher: Matcher = { kind: 'substring', substring: 'example' };
  const result = matchesUrl(
    matcher,
    'https://example.com/some-path?query=1#/hash/path',
    '?query=1',
    '#/hash/path',
  );
  expect(result).toBe(true);
});

it('includes the hash for "path-like" hashes for "regex" matchers', () => {
  const matcher: Matcher = { kind: 'regex', pattern: 'hash' };
  const result = matchesUrl(
    matcher,
    'https://example.com/some-path?query=1#/hash/path',
    '?query=1',
    '#/hash/path',
  );
  expect(result).toBe(true);
});

it('returns false for unsupported matcher kind', () => {
  // @ts-expect-error
  const matcher: Matcher = { kind: 'unsupported' };
  const result = matchesUrl(matcher, 'https://example.com', '', '');
  expect(result).toBe(false);
});
