import {
  Encoding,
  EventSource,
  EventSourceCapabilities,
  EventSourceInitDict,
  Requests,
  Response,
  ServiceEndpoints,
} from '@launchdarkly/js-sdk-common';

import { DataSourcePaths } from '../../../src/datasource/DataSourceConfig';
import { makeFDv2Requestor } from '../../../src/datasource/fdv2/FDv2Requestor';

function mockResponse(value: string, statusCode: number) {
  const headersMap: Record<string, string> = {};
  const response: Response = {
    headers: {
      // @ts-ignore
      get: jest.fn((name: string) => headersMap[name.toLowerCase()] ?? null),
      keys: jest.fn(),
      values: jest.fn(),
      entries: jest.fn(),
      has: jest.fn(),
    },
    status: statusCode,
    text: () => Promise.resolve(value),
    json: () => Promise.resolve(JSON.parse(value)),
  };
  return { response, headersMap };
}

function makeRequests(
  value: string = '{}',
  statusCode: number = 200,
): {
  requests: Requests;
  fetch: jest.Mock;
} {
  const { response } = mockResponse(value, statusCode);
  const fetch = jest.fn().mockResolvedValue(response);
  return {
    requests: {
      fetch,
      createEventSource(_url: string, _eventSourceInitDict: EventSourceInitDict): EventSource {
        throw new Error('Function not implemented.');
      },
      getEventSourceCapabilities(): EventSourceCapabilities {
        return { readTimeout: false, headers: false, customMethod: false };
      },
    },
    fetch,
  };
}

const serviceEndpoints: ServiceEndpoints = {
  events: 'mockEventsEndpoint',
  polling: 'https://sdk.launchdarkly.com',
  streaming: 'mockStreamingEndpoint',
  diagnosticEventPath: '/diagnostic',
  analyticsEventPath: '/bulk',
  includeAuthorizationHeader: true,
  payloadFilterKey: undefined,
};

const encoding: Encoding = {
  btoa: (s: string) => Buffer.from(s).toString('base64'),
};

const paths: DataSourcePaths = {
  pathGet(_encoding: Encoding, plainContextString: string): string {
    return `/sdk/poll/eval/${_encoding.btoa(plainContextString)}`;
  },
  pathReport(_encoding: Encoding, _plainContextString: string): string {
    throw new Error('Report unsupported.');
  },
  pathPost(_encoding: Encoding, _plainContextString: string): string {
    return '/sdk/poll/eval';
  },
  pathPing(_encoding: Encoding, _plainContextString: string): string {
    throw new Error('Ping unsupported.');
  },
};

it('makes a GET request by default with context in URL path', async () => {
  const { requests, fetch } = makeRequests();

  const requestor = makeFDv2Requestor(
    '{"key":"user1"}',
    serviceEndpoints,
    paths,
    requests,
    encoding,
  );
  await requestor.poll();

  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, options] = fetch.mock.calls[0];
  expect(url).toContain('/sdk/poll/eval/');
  expect(options.method).toBe('GET');
  expect(options.body).toBeUndefined();
});

it('makes a POST request with context in body when usePost is true', async () => {
  const { requests, fetch } = makeRequests();

  const requestor = makeFDv2Requestor(
    '{"key":"user1"}',
    serviceEndpoints,
    paths,
    requests,
    encoding,
    undefined,
    undefined,
    true,
  );
  await requestor.poll();

  const [url, options] = fetch.mock.calls[0];
  expect(url).toContain('/sdk/poll/eval');
  expect(url).not.toContain('/sdk/poll/eval/');
  expect(options.method).toBe('POST');
  expect(options.body).toBe('{"key":"user1"}');
  expect(options.headers['content-type']).toBe('application/json');
});

it('includes basis query parameter when provided', async () => {
  const { requests, fetch } = makeRequests();

  const requestor = makeFDv2Requestor(
    '{"key":"user1"}',
    serviceEndpoints,
    paths,
    requests,
    encoding,
  );
  await requestor.poll('some-opaque-state');

  const [url] = fetch.mock.calls[0];
  expect(url).toContain('basis=some-opaque-state');
});

it('does not include basis query parameter when not provided', async () => {
  const { requests, fetch } = makeRequests();

  const requestor = makeFDv2Requestor(
    '{"key":"user1"}',
    serviceEndpoints,
    paths,
    requests,
    encoding,
  );
  await requestor.poll();

  const [url] = fetch.mock.calls[0];
  expect(url).not.toContain('basis=');
});

it('does not include basis query parameter when basis is an empty string', async () => {
  const { requests, fetch } = makeRequests();

  const requestor = makeFDv2Requestor(
    '{"key":"user1"}',
    serviceEndpoints,
    paths,
    requests,
    encoding,
  );
  await requestor.poll('');

  const [url] = fetch.mock.calls[0];
  expect(url).not.toContain('basis=');
});

it('includes base query parameters on every request', async () => {
  const { requests, fetch } = makeRequests();

  const requestor = makeFDv2Requestor(
    '{"key":"user1"}',
    serviceEndpoints,
    paths,
    requests,
    encoding,
    undefined,
    [
      { key: 'withReasons', value: 'true' },
      { key: 'h', value: 'secure-hash' },
    ],
  );
  await requestor.poll();

  const [url] = fetch.mock.calls[0];
  expect(url).toContain('withReasons=true');
  expect(url).toContain('h=secure-hash');
});

it('includes authorization header from base headers', async () => {
  const { requests, fetch } = makeRequests();

  const requestor = makeFDv2Requestor(
    '{"key":"user1"}',
    serviceEndpoints,
    paths,
    requests,
    encoding,
    { authorization: 'my-sdk-key', 'user-agent': 'TestSDK/1.0' },
  );
  await requestor.poll();

  const [, options] = fetch.mock.calls[0];
  expect(options.headers.authorization).toBe('my-sdk-key');
  expect(options.headers['user-agent']).toBe('TestSDK/1.0');
});

it('returns full response info including status and headers', async () => {
  const { response, headersMap } = mockResponse('{"events":[]}', 200);
  headersMap['x-ld-envid'] = 'env-123';
  const fetch = jest.fn().mockResolvedValue(response);

  const requests: Requests = {
    fetch,
    createEventSource(_url: string, _eventSourceInitDict: EventSourceInitDict): EventSource {
      throw new Error('Function not implemented.');
    },
    getEventSourceCapabilities(): EventSourceCapabilities {
      return { readTimeout: false, headers: false, customMethod: false };
    },
  };

  const requestor = makeFDv2Requestor(
    '{"key":"user1"}',
    serviceEndpoints,
    paths,
    requests,
    encoding,
  );
  const result = await requestor.poll();

  expect(result.status).toBe(200);
  expect(result.body).toBe('{"events":[]}');
  expect(result.headers.get('x-ld-envid')).toBe('env-123');
});

it('returns null body for 304 responses', async () => {
  const { response } = mockResponse('', 304);
  const fetch = jest.fn().mockResolvedValue(response);

  const requests: Requests = {
    fetch,
    createEventSource(_url: string, _eventSourceInitDict: EventSourceInitDict): EventSource {
      throw new Error('Function not implemented.');
    },
    getEventSourceCapabilities(): EventSourceCapabilities {
      return { readTimeout: false, headers: false, customMethod: false };
    },
  };

  const requestor = makeFDv2Requestor(
    '{"key":"user1"}',
    serviceEndpoints,
    paths,
    requests,
    encoding,
  );
  const result = await requestor.poll();

  expect(result.status).toBe(304);
  expect(result.body).toBeNull();
});

it('propagates fetch errors', async () => {
  const fetch = jest.fn().mockRejectedValue(new Error('network failure'));

  const requests: Requests = {
    fetch,
    createEventSource(_url: string, _eventSourceInitDict: EventSourceInitDict): EventSource {
      throw new Error('Function not implemented.');
    },
    getEventSourceCapabilities(): EventSourceCapabilities {
      return { readTimeout: false, headers: false, customMethod: false };
    },
  };

  const requestor = makeFDv2Requestor(
    '{"key":"user1"}',
    serviceEndpoints,
    paths,
    requests,
    encoding,
  );

  await expect(requestor.poll()).rejects.toThrow('network failure');
});
