import { processUrlToFileName, TrimOptions, trimSourceLine } from '../../src/stack/StackParser';

it.each([
  ['http://www.launchdarkly.com', 'http://www.launchdarkly.com/', '(index)'],
  ['http://www.launchdarkly.com', 'http://www.launchdarkly.com/test/(index)', 'test/(index)'],
  ['http://www.launchdarkly.com', 'http://www.launchdarkly.com/test.js', 'test.js'],
  ['http://localhost:8080', 'http://localhost:8080/dist/main.js', 'dist/main.js'],
])('handles URL parsing to file names', (origin: string, url: string, expected: string) => {
  expect(processUrlToFileName(url, origin)).toEqual(expected);
});

it.each([
  ['this is the source line', 5, { maxLength: 10, beforeColumnCharacters: 2 }, 's is the s'],
  ['this is the source line', 0, { maxLength: 10, beforeColumnCharacters: 2 }, 'this is th'],
  ['this is the source line', 2, { maxLength: 10, beforeColumnCharacters: 0 }, 'is is the '],
  ['12345', 0, { maxLength: 5, beforeColumnCharacters: 2 }, '12345'],
  ['this is the source line', 21, { maxLength: 10, beforeColumnCharacters: 2 }, 'line'],
])(
  'trims source lines',
  (source: string, column: number, options: TrimOptions, expected: string) => {
    expect(trimSourceLine(options, source, column)).toEqual(expected);
  },
);
