import { createEventSource as mockedCreateEventSource } from '@launchdarkly/eventsource';
import { EventSourceInitDict } from '@launchdarkly/js-client-sdk-common';

import fetchBrowserEventSource from '../../src/platform/fetchBrowserEventSource';

// The fetch-based EventSource needs a streaming fetch, which jsdom does not provide. Only the
// adapter is under test here; the implementation itself is covered by the eventsource package's
// own suite.
jest.mock('@launchdarkly/eventsource', () => ({
  createEventSource: jest.fn(),
}));

const mockCreateEventSource = mockedCreateEventSource as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

it('declares support for headers, a custom method, and a read timeout', () => {
  expect(fetchBrowserEventSource.capabilities).toEqual({
    customMethod: true,
    readTimeout: true,
    headers: true,
  });
});

it('passes the url and every option through, plus the backoff defaults', () => {
  const urlBuilder = () => 'http://example.com/stream?basis=2';
  const errorFilter = () => true;
  const initDict: EventSourceInitDict = {
    method: 'REPORT',
    headers: { authorization: 'sdk-key' },
    body: '{"kind":"user"}',
    errorFilter,
    initialRetryDelayMillis: 1000,
    readTimeoutMillis: 300000,
    retryResetIntervalMillis: 60000,
    urlBuilder,
  };

  fetchBrowserEventSource.createEventSource('http://example.com/stream', initDict);

  expect(mockCreateEventSource).toHaveBeenCalledTimes(1);
  expect(mockCreateEventSource).toHaveBeenCalledWith('http://example.com/stream', {
    method: 'REPORT',
    headers: { authorization: 'sdk-key' },
    body: '{"kind":"user"}',
    errorFilter,
    initialRetryDelayMillis: 1000,
    readTimeoutMillis: 300000,
    retryResetIntervalMillis: 60000,
    urlBuilder,
    maxBackoffMillis: 30000,
    jitterRatio: 0.5,
  });
});
