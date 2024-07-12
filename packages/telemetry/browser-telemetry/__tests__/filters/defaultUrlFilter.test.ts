import defaultUrlFilter from '../../src/filters/defaultUrlFilter';

it('filters polling urls', () => {
  const context =
    'eyJraW5kIjoibXVsdGkiLCJ1c2VyIjp7ImtleSI6ImJvYiJ9LCJvcmciOnsia2V5IjoidGFjb2h1dCJ9fQ';
  const filteredCotext =
    '**********************************************************************************';
  const baseUrl = 'https://sdk.launchdarkly.com/sdk/evalx/thesdkkey/contexts/';
  const filteredUrl = `${baseUrl}${filteredCotext}`;
  const testUrl = `${baseUrl}${context}`;
  const testUrlWithReasons = `${testUrl}?withReasons=true`;
  const filteredUrlWithReasons = `${filteredUrl}?withReasons=true`;

  expect(defaultUrlFilter(testUrl)).toBe(filteredUrl);
  expect(defaultUrlFilter(testUrlWithReasons)).toBe(filteredUrlWithReasons);
});

it('filters streaming urls', () => {
  const context =
    'eyJraW5kIjoibXVsdGkiLCJ1c2VyIjp7ImtleSI6ImJvYiJ9LCJvcmciOnsia2V5IjoidGFjb2h1dCJ9fQ';
  const filteredCotext =
    '**********************************************************************************';
  const baseUrl = `https://clientstream.launchdarkly.com/eval/thesdkkey/`;
  const filteredUrl = `${baseUrl}${filteredCotext}`;
  const testUrl = `${baseUrl}${context}`;
  const testUrlWithReasons = `${testUrl}?withReasons=true`;
  const filteredUrlWithReasons = `${filteredUrl}?withReasons=true`;

  expect(defaultUrlFilter(testUrl)).toBe(filteredUrl);
  expect(defaultUrlFilter(testUrlWithReasons)).toBe(filteredUrlWithReasons);
});

it.each([
  'http://events.launchdarkly.com/events/bulk/thesdkkey',
  'http://localhost:8080',
  'http://some.other.base64like/eyJraW5kIjoibXVsdGkiLCJ1c2VyIjp7ImtleSI6vcmciOnsiaIjoidGFjb2h1dCJ9fQ',
])('passes through other URLs unfiltered', (url) => {
  expect(defaultUrlFilter(url)).toBe(url);
});
