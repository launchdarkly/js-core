import { EventSourceInitDict, LDEventSourceFactory } from '@launchdarkly/js-client-sdk-common';

import BrowserRequests from '../../src/platform/BrowserRequests';
import DefaultBrowserEventSource from '../../src/platform/DefaultBrowserEventSource';

const initDict: EventSourceInitDict = {
  headers: { authorization: 'sdk-key' },
  errorFilter: () => true,
  initialRetryDelayMillis: 1000,
  readTimeoutMillis: 300000,
  retryResetIntervalMillis: 60000,
};

beforeEach(() => {
  // jsdom does not implement EventSource, and DefaultBrowserEventSource constructs one as soon as
  // it is created.
  // @ts-ignore
  globalThis.EventSource = jest.fn(() => ({
    addEventListener: jest.fn(),
    close: jest.fn(),
  }));
});

it('reports no optional capabilities by default', () => {
  const requests = new BrowserRequests();

  expect(requests.getEventSourceCapabilities()).toEqual({
    customMethod: false,
    readTimeout: false,
    headers: false,
  });
});

it('creates a native browser event source by default', () => {
  const requests = new BrowserRequests();

  const es = requests.createEventSource('http://example.com/stream', initDict);

  expect(es).toBeInstanceOf(DefaultBrowserEventSource);
  es.close();
});

it('uses an injected factory and its declared capabilities', () => {
  const created = { close: jest.fn() };
  const factory: LDEventSourceFactory = {
    createEventSource: jest.fn().mockReturnValue(created),
    capabilities: { customMethod: true, readTimeout: true, headers: true },
  };
  const requests = new BrowserRequests(factory);

  expect(requests.createEventSource('http://example.com/stream', initDict)).toBe(created);
  expect(factory.createEventSource).toHaveBeenCalledWith('http://example.com/stream', initDict);
  expect(requests.getEventSourceCapabilities()).toEqual({
    customMethod: true,
    readTimeout: true,
    headers: true,
  });
});

it('reports no optional capabilities for a factory that declares none', () => {
  const factory: LDEventSourceFactory = { createEventSource: jest.fn() };
  const requests = new BrowserRequests(factory);

  expect(requests.getEventSourceCapabilities()).toEqual({
    customMethod: false,
    readTimeout: false,
    headers: false,
  });
});
