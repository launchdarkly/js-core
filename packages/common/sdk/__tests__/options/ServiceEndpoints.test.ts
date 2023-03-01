import ServiceEndpoints from '../../src/options/ServiceEndpoints';

describe.each([
  [
    { baseUri: 'https://sdk.launchdarkly.com', streamingUri: 'https://stream.launchdarkly.com', eventsUri: 'https://events.launchdarkly.com' },
    { baseUri: 'https://sdk.launchdarkly.com', streamingUri: 'https://stream.launchdarkly.com', eventsUri: 'https://events.launchdarkly.com' },
  ],
  [
    { baseUri: 'https://sdk.launchdarkly.com/', streamingUri: 'https://stream.launchdarkly.com/', eventsUri: 'https://events.launchdarkly.com/' },
    { baseUri: 'https://sdk.launchdarkly.com', streamingUri: 'https://stream.launchdarkly.com', eventsUri: 'https://events.launchdarkly.com' },
  ],
])('given endpoint urls', (input, expected) => {
  it('has canonical urls', () => {
    const endpoints = new ServiceEndpoints(input.streamingUri, input.baseUri, input.eventsUri);
    expect(endpoints.streaming).toEqual(expected.streamingUri);
    expect(endpoints.polling).toEqual(expected.baseUri);
    expect(endpoints.events).toEqual(expected.eventsUri);
  });
});
