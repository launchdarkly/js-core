import { processUrlToFileName } from '../src/stack/StackParser';

it.each([
  ['http://www.launchdarkly.com', 'http://www.launchdarkly.com/', '(index)'],
  ['http://www.launchdarkly.com', 'http://www.launchdarkly.com/test/(index)', 'test/(index)'],
  ['http://www.launchdarkly.com', 'http://www.launchdarkly.com/test.js', 'test.js'],
  ['http://localhost:8080', 'http://localhost:8080/dist/main.js', 'dist/main.js'],
])('handles URL parsing to file names', (origin: string, url: string, expected: string) => {
  expect(processUrlToFileName(url, origin)).toEqual(expected);
});
