import type { LDLogger } from '@launchdarkly/js-client-sdk-common';

import { createClient } from '../src';
import { makeMockPlatform, mockFetch } from './NodeClient.mocks';

jest.mock('../src/platform/NodePlatform', () => {
  const { makeMockPlatform: makePlatform } = jest.requireActual('./NodeClient.mocks');
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => makePlatform()),
  };
});

const NodePlatformMock = jest.requireMock('../src/platform/NodePlatform').default as jest.Mock;

const bootstrapData = {
  $flagsState: {},
  $valid: true,
};

let logger: LDLogger;

beforeEach(() => {
  logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  NodePlatformMock.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('track() sends a custom event over HTTP after flush', async () => {
  const fetchMock = mockFetch('', 202);
  const fakePlatform = makeMockPlatform({
    requests: {
      fetch: fetchMock,
      createEventSource: jest.fn(),
      getEventSourceCapabilities: () => ({ readTimeout: true, headers: true, customMethod: true }),
    },
  });
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'offline',
      sendEvents: true,
      diagnosticOptOut: true,
      logger,
    },
  );

  await client.start({ bootstrap: bootstrapData });
  client.track('eventkey', { thing: 'stuff' }, 42);
  await client.flush();

  const analyticsCall = fetchMock.mock.calls.find(([url]: [string]) => url.includes('/events/bulk/'));
  expect(analyticsCall).toBeDefined();

  const body = JSON.parse(analyticsCall![1].body);
  const customEvent = body.find((e: any) => e.kind === 'custom');
  expect(customEvent).toMatchObject({
    kind: 'custom',
    key: 'eventkey',
    data: { thing: 'stuff' },
    metricValue: 42,
    context: { kind: 'user', key: 'bob' },
  });

  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();

  await client.close();
});

it('sends a diagnostic init event when diagnostics are not opted out', async () => {
  const fetchMock = mockFetch('', 202);
  const fakePlatform = makeMockPlatform({
    requests: {
      fetch: fetchMock,
      // Stub EventSource -- the streaming connection is opened but we don't drive it.
      createEventSource: jest.fn(() => ({
        addEventListener: jest.fn(),
        close: jest.fn(),
        onclose: jest.fn(),
        onerror: jest.fn(),
        onopen: jest.fn(),
        onretrying: jest.fn(),
      })),
      getEventSourceCapabilities: () => ({ readTimeout: true, headers: true, customMethod: true }),
    },
  });
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  // Streaming (not offline) so the EventProcessor starts, which is what triggers the
  // diagnostic init event. Bootstrap keeps identify from waiting on the stream.
  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'streaming',
      sendEvents: true,
      diagnosticOptOut: false,
      logger,
    },
  );

  await client.start({ bootstrap: bootstrapData });
  await client.flush();

  const diagnosticCall = fetchMock.mock.calls.find(([url]: [string]) =>
    url.includes('/events/diagnostic/'),
  );
  expect(diagnosticCall).toBeDefined();

  const body = JSON.parse(diagnosticCall![1].body);
  expect(body.kind).toBe('diagnostic-init');
  expect(body.platform).toMatchObject({ name: 'Node' });
  expect(body.sdk).toMatchObject({ name: 'node-client-sdk' });

  await client.close();
});

it('includes authorization and user-agent headers on the events request', async () => {
  const fetchMock = mockFetch('', 202);
  const fakePlatform = makeMockPlatform({
    requests: {
      fetch: fetchMock,
      createEventSource: jest.fn(),
      getEventSourceCapabilities: () => ({ readTimeout: true, headers: true, customMethod: true }),
    },
  });
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'offline',
      sendEvents: true,
      diagnosticOptOut: true,
      logger,
    },
  );

  await client.start({ bootstrap: bootstrapData });
  client.track('hello');
  await client.flush();

  const analyticsCall = fetchMock.mock.calls.find(([url]: [string]) => url.includes('/events/bulk/'));
  expect(analyticsCall).toBeDefined();

  const headers = analyticsCall![1].headers;
  expect(headers).toMatchObject({
    authorization: 'client-side-id',
  });
  // The SDK user-agent header is keyed off NodeInfo.sdkData().userAgentBase. The mocked
  // platform reports 'NodeClient', so the header value should start with that prefix.
  expect(headers['user-agent']).toMatch(/^NodeClient\//);

  await client.close();
});

it('delivers events tracked across an offline transition once back online', async () => {
  const fetchMock = mockFetch('', 202);
  const fakePlatform = makeMockPlatform({
    requests: {
      fetch: fetchMock,
      createEventSource: jest.fn(() => ({
        addEventListener: jest.fn(),
        close: jest.fn(),
        onclose: jest.fn(),
        onerror: jest.fn(),
        onopen: jest.fn(),
        onretrying: jest.fn(),
      })),
      getEventSourceCapabilities: () => ({ readTimeout: true, headers: true, customMethod: true }),
    },
  });
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'streaming',
      sendEvents: true,
      diagnosticOptOut: true,
      logger,
    },
  );

  await client.start({ bootstrap: bootstrapData });

  client.track('eventA');
  await client.setConnectionMode('offline');
  client.track('eventB');
  await client.setConnectionMode('streaming');
  client.track('eventC');
  await client.flush();

  const customKeys = new Set<string>();
  fetchMock.mock.calls
    .filter(([url]: [string]) => url.includes('/events/bulk/'))
    .forEach((call: any) => {
      try {
        JSON.parse(call[1].body).forEach((e: any) => {
          if (e.kind === 'custom') {
            customKeys.add(e.key);
          }
        });
      } catch {
        // not JSON, skip
      }
    });

  expect(customKeys.has('eventA')).toBe(true);
  expect(customKeys.has('eventB')).toBe(true);
  expect(customKeys.has('eventC')).toBe(true);

  await client.close();
});
