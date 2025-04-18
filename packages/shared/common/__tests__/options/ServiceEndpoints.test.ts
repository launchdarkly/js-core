import ServiceEndpoints, {
  getEventsUri,
  getPollingUri,
  getStreamingUri,
} from '../../src/options/ServiceEndpoints';

describe.each([
  [
    {
      baseUri: 'https://sdk.launchdarkly.com',
      streamingUri: 'https://stream.launchdarkly.com',
      eventsUri: 'https://events.launchdarkly.com',
    },
    {
      baseUri: 'https://sdk.launchdarkly.com',
      streamingUri: 'https://stream.launchdarkly.com',
      eventsUri: 'https://events.launchdarkly.com',
    },
  ],
  [
    {
      baseUri: 'https://sdk.launchdarkly.com/',
      streamingUri: 'https://stream.launchdarkly.com/',
      eventsUri: 'https://events.launchdarkly.com/',
    },
    {
      baseUri: 'https://sdk.launchdarkly.com',
      streamingUri: 'https://stream.launchdarkly.com',
      eventsUri: 'https://events.launchdarkly.com',
    },
  ],
])('given endpoint urls', (input, expected) => {
  it('has canonical urls', () => {
    const endpoints = new ServiceEndpoints(input.streamingUri, input.baseUri, input.eventsUri);
    expect(endpoints.streaming).toEqual(expected.streamingUri);
    expect(endpoints.polling).toEqual(expected.baseUri);
    expect(endpoints.events).toEqual(expected.eventsUri);
  });
});

it('applies payload filter to polling and streaming endpoints', () => {
  const endpoints = new ServiceEndpoints(
    'https://stream.launchdarkly.com',
    'https://sdk.launchdarkly.com',
    'https://events.launchdarkly.com',
    '/bulk',
    '/diagnostic',
    true,
    'filterKey',
  );

  expect(getStreamingUri(endpoints, '/sdk/stream', [])).toEqual(
    'https://stream.launchdarkly.com/sdk/stream?filter=filterKey',
  );
  expect(getPollingUri(endpoints, '/sdk/poll', [])).toEqual(
    'https://sdk.launchdarkly.com/sdk/poll?filter=filterKey',
  );
  expect(
    getPollingUri(endpoints, '/sdk/poll', [{ key: 'withReasons', value: 'true' }]),
  ).toEqual('https://sdk.launchdarkly.com/sdk/poll?withReasons=true&filter=filterKey');
  expect(getEventsUri(endpoints, '/bulk', [])).toEqual('https://events.launchdarkly.com/bulk');
});
