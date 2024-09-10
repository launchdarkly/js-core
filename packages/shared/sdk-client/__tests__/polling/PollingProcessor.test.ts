import { waitFor } from '@testing-library/dom';

import {
  EventSource,
  EventSourceCapabilities,
  EventSourceInitDict,
  Info,
  PlatformData,
  Requests,
  Response,
  SdkData,
} from '@launchdarkly/js-sdk-common';

import PollingProcessor, { PollingConfig } from '../../src/polling/PollingProcessor';

function mockResponse(value: string, statusCode: number) {
  const response: Response = {
    headers: {
      get: jest.fn(),
      keys: jest.fn(),
      values: jest.fn(),
      entries: jest.fn(),
      has: jest.fn(),
    },
    status: statusCode,
    text: () => Promise.resolve(value),
    json: () => Promise.resolve(JSON.parse(value)),
  };
  return Promise.resolve(response);
}

/**
 * Mocks fetch. Returns the fetch jest.Mock object.
 * @param remoteJson
 * @param statusCode
 */
function mockFetch(value: string, statusCode: number = 200) {
  const f = jest.fn();
  f.mockResolvedValue(mockResponse(value, statusCode));
  return f;
}

function makeRequests(): Requests {
  return {
    fetch: mockFetch('{ "flagA": true }', 200),
    createEventSource(_url: string, _eventSourceInitDict: EventSourceInitDict): EventSource {
      throw new Error('Function not implemented.');
    },
    getEventSourceCapabilities(): EventSourceCapabilities {
      return {
        readTimeout: false,
        headers: false,
        customMethod: false,
      };
    },
  };
}

function makeInfo(sdkData: SdkData = {}, platformData: PlatformData = {}): Info {
  return {
    sdkData: () => sdkData,
    platformData: () => platformData,
  };
}

function makeConfig(config?: { pollInterval?: number; useReport?: boolean }): PollingConfig {
  return {
    pollInterval: config?.pollInterval ?? 60 * 5,
    // eslint-disable-next-line no-console
    logger: {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    },
    tags: {},
    useReport: config?.useReport ?? false,
    serviceEndpoints: {
      streaming: '',
      polling: 'http://example.example.example',
      events: '',
      analyticsEventPath: '',
      diagnosticEventPath: '',
      includeAuthorizationHeader: false,
    },
  };
}

it('makes no requests until it is started', () => {
  const requests = makeRequests();
  // eslint-disable-next-line no-new
  new PollingProcessor(
    'the-sdk-key',
    requests,
    makeInfo(),
    '/polling',
    [],
    makeConfig(),
    (_flags) => {},
    (_error) => {},
  );

  expect(requests.fetch).toHaveBeenCalledTimes(0);
});

it('polls immediately when started', () => {
  const requests = makeRequests();

  const polling = new PollingProcessor(
    'the-sdk-key',
    requests,
    makeInfo(),
    '/polling',
    [],
    makeConfig(),
    (_flags) => {},
    (_error) => {},
  );
  polling.start();

  expect(requests.fetch).toHaveBeenCalledTimes(1);
  polling.stop();
});

it('calls callback on success', async () => {
  const requests = makeRequests();
  const dataCallback = jest.fn();
  const errorCallback = jest.fn();

  const polling = new PollingProcessor(
    'the-sdk-key',
    requests,
    makeInfo(),
    '/polling',
    [],
    makeConfig(),
    dataCallback,
    errorCallback,
  );
  polling.start();

  await waitFor(() => expect(requests.fetch).toHaveBeenCalled());
  polling.stop();
});

it('polls repeatedly', async () => {
  const requests = makeRequests();
  const dataCallback = jest.fn();
  const errorCallback = jest.fn();

  requests.fetch = mockFetch('{ "flagA": true }', 200);
  const polling = new PollingProcessor(
    'the-sdk-key',
    requests,
    makeInfo(),
    '/polling',
    [],
    makeConfig({ pollInterval: 0.1 }),
    dataCallback,
    errorCallback,
  );
  polling.start();

  // There is not a check for called at least N times. So we make a new mock and wait for it
  // to be called at least a second time. If you use toHaveBeenCalledNTimes(2), the it could
  // get called 3 times before being checked and the test would fail.
  await waitFor(() => expect(requests.fetch).toHaveBeenCalled());
  requests.fetch = mockFetch('{ "flagA": true }', 200);
  await waitFor(() => expect(requests.fetch).toHaveBeenCalled());

  polling.stop();
});

it('stops polling when stopped', (done) => {
  const requests = {
    fetch: jest.fn(),
    createEventSource(_url: string, _eventSourceInitDict: EventSourceInitDict): EventSource {
      throw new Error('Function not implemented.');
    },
  };
  const dataCallback = jest.fn();
  const errorCallback = jest.fn();

  const polling = new PollingProcessor(
    'the-sdk-key',
    requests,
    makeInfo(),
    '/stops',
    [],
    makeConfig({ pollInterval: 0.01 }),
    dataCallback,
    errorCallback,
  );
  polling.start();
  polling.stop();

  // Give a little time for potentially multiple polls to complete.
  setTimeout(() => {
    expect(requests.fetch).toHaveBeenCalledTimes(1);
    done();
  }, 50);
});

it('includes the correct headers on requests', () => {
  const requests = makeRequests();

  const polling = new PollingProcessor(
    'the-sdk-key',
    requests,
    makeInfo({
      userAgentBase: 'AnSDK',
      version: '42',
    }),
    '/polling',
    [],
    makeConfig(),
    (_flags) => {},
    (_error) => {},
  );
  polling.start();

  expect(requests.fetch).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      headers: {
        authorization: 'the-sdk-key',
        'user-agent': 'AnSDK/42',
      },
    }),
  );
  polling.stop();
});

it('defaults to using the "GET" verb', () => {
  const requests = makeRequests();

  const polling = new PollingProcessor(
    'the-sdk-key',
    requests,
    makeInfo(),
    '/polling',
    [],
    makeConfig(),
    (_flags) => {},
    (_error) => {},
  );
  polling.start();

  expect(requests.fetch).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      method: 'GET',
    }),
  );
  polling.stop();
});

it('can be configured to use the "REPORT" verb', () => {
  const requests = makeRequests();

  const polling = new PollingProcessor(
    'the-sdk-key',
    requests,
    makeInfo(),
    '/polling',
    [],
    makeConfig({ useReport: true }),
    (_flags) => {},
    (_error) => {},
  );
  polling.start();

  expect(requests.fetch).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      method: 'REPORT',
    }),
  );
  polling.stop();
});

it('continues polling after receiving bad JSON', async () => {
  const requests = makeRequests();
  const dataCallback = jest.fn();
  const errorCallback = jest.fn();
  const config = makeConfig({ pollInterval: 0.1 });

  const polling = new PollingProcessor(
    'the-sdk-key',
    requests,
    makeInfo(),
    '/polling',
    [],
    config,
    dataCallback,
    errorCallback,
  );
  polling.start();

  // There is not a check for called at least N times. So we make a new mock and wait for it
  // to be called at least a second time. If you use toHaveBeenCalledNTimes(2), the it could
  // get called 3 times before being checked and the test would fail.
  await waitFor(() => expect(requests.fetch).toHaveBeenCalled());
  requests.fetch = mockFetch('{ham', 200);
  await waitFor(() => expect(requests.fetch).toHaveBeenCalled());
  await waitFor(() => expect(errorCallback).toHaveBeenCalled());
  expect(config.logger.error).toHaveBeenCalledWith('Polling received invalid data');
  polling.stop();
});

it('continues polling after an exception thrown during a request', async () => {
  const requests = makeRequests();
  const dataCallback = jest.fn();
  const errorCallback = jest.fn();
  const config = makeConfig({ pollInterval: 0.1 });

  const polling = new PollingProcessor(
    'the-sdk-key',
    requests,
    makeInfo(),
    '/polling',
    [],
    config,
    dataCallback,
    errorCallback,
  );
  polling.start();

  // There is not a check for called at least N times. So we make a new mock and wait for it
  // to be called at least a second time. If you use toHaveBeenCalledNTimes(2), the it could
  // get called 3 times before being checked and the test would fail.
  await waitFor(() => expect(requests.fetch).toHaveBeenCalled());
  requests.fetch = jest.fn(() => {
    throw new Error('bad');
  });
  await waitFor(() => expect(requests.fetch).toHaveBeenCalled());
  polling.stop();
  expect(config.logger.error).toHaveBeenCalledWith(
    'Received I/O error (bad) for polling request - will retry',
  );
});

it('can handle recoverable http errors', async () => {
  const requests = makeRequests();
  const dataCallback = jest.fn();
  const errorCallback = jest.fn();
  const config = makeConfig({ pollInterval: 0.1 });

  const polling = new PollingProcessor(
    'the-sdk-key',
    requests,
    makeInfo(),
    '/polling',
    [],
    config,
    dataCallback,
    errorCallback,
  );
  polling.start();

  // There is not a check for called at least N times. So we make a new mock and wait for it
  // to be called at least a second time. If you use toHaveBeenCalledNTimes(2), the it could
  // get called 3 times before being checked and the test would fail.
  await waitFor(() => expect(requests.fetch).toHaveBeenCalled());
  requests.fetch = mockFetch('', 408);
  await waitFor(() => expect(requests.fetch).toHaveBeenCalled());
  polling.stop();
  expect(config.logger.error).toHaveBeenCalledWith(
    'Received error 408 for polling request - will retry',
  );
});

it('stops polling on unrecoverable error codes', (done) => {
  const requests = makeRequests();
  const dataCallback = jest.fn();
  const errorCallback = jest.fn();
  const config = makeConfig({ pollInterval: 0.01 });

  const polling = new PollingProcessor(
    'the-sdk-key',
    requests,
    makeInfo(),
    '/polling',
    [],
    config,
    dataCallback,
    errorCallback,
  );
  polling.start();

  requests.fetch = mockFetch('', 401);

  // Polling should stop on the 401, but we need to give some time for more
  // polls to be done.
  setTimeout(() => {
    expect(config.logger.error).toHaveBeenCalledWith(
      'Received error 401 (invalid SDK key) for polling request - giving up permanently',
    );
    expect(requests.fetch).toHaveBeenCalledTimes(1);
    done();
  }, 50);
});
