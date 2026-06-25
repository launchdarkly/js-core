import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import type { Response } from '@launchdarkly/js-client-sdk-common';

import { createClient } from '../src';
import { resetNodeStorage } from '../src/platform/NodeStorage';
import NodeCrypto from '../src/platform/NodeCrypto';
import NodeEncoding from '../src/platform/NodeEncoding';
import NodeInfo from '../src/platform/NodeInfo';
import { createMockLogger } from './testHelpers';

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

function mockFetch(value: string, statusCode: number = 200) {
  const f = jest.fn();
  f.mockResolvedValue(mockResponse(value, statusCode));
  return f;
}

const createMockEventSource = (streamUri: string = '', options: any = {}) => ({
  streamUri,
  options,
  onclose: jest.fn(),
  addEventListener: jest.fn(),
  close: jest.fn(),
});

const createMockEventSourceThatDeliversPut = (streamUri: string = '', options: any = {}) => ({
  ...createMockEventSource(streamUri, options),
  addEventListener: jest.fn((eventName: string, callback: (e: { data?: string }) => void) => {
    if (eventName === 'put') {
      Promise.resolve().then(() => callback({ data: '{}' }));
    }
  }),
});

jest.mock('../src/platform/NodePlatform', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    crypto: new NodeCrypto(),
    info: new NodeInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new NodeEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  })),
}));

const NodePlatform = require('../src/platform/NodePlatform').default;

const DEFAULT_INITIAL_CONTEXT = { kind: 'user' as const, key: 'bob' };

let tmpRoot: string;
let logger: ReturnType<typeof createMockLogger>;

beforeAll(() => {
  jest.useFakeTimers();
});

beforeEach(async () => {
  jest.clearAllMocks();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'node-client-test-'));
  resetNodeStorage();
  logger = createMockLogger();
});

afterEach(async () => {
  resetNodeStorage();
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

it('createClient returns the documented LDClient surface', () => {
  const client = createClient('client-side-id', { kind: 'user', key: 'bob' }, {
    initialConnectionMode: 'offline',
    sendEvents: false,
    diagnosticOptOut: true,
    localStoragePath: tmpRoot,
    logger,
  });

  expect(typeof client.start).toBe('function');
  expect(typeof client.identify).toBe('function');
  expect(typeof client.close).toBe('function');
  expect(typeof client.variation).toBe('function');
  expect(typeof client.variationDetail).toBe('function');
  expect(typeof client.boolVariation).toBe('function');
  expect(typeof client.boolVariationDetail).toBe('function');
  expect(typeof client.stringVariation).toBe('function');
  expect(typeof client.stringVariationDetail).toBe('function');
  expect(typeof client.numberVariation).toBe('function');
  expect(typeof client.numberVariationDetail).toBe('function');
  expect(typeof client.jsonVariation).toBe('function');
  expect(typeof client.jsonVariationDetail).toBe('function');
  expect(typeof client.allFlags).toBe('function');
  expect(typeof client.track).toBe('function');
  expect(typeof client.flush).toBe('function');
  expect(typeof client.on).toBe('function');
  expect(typeof client.off).toBe('function');
  expect(typeof client.addHook).toBe('function');
  expect(typeof client.waitForInitialization).toBe('function');
  expect(typeof client.setConnectionMode).toBe('function');
  expect(typeof client.getConnectionMode).toBe('function');
  expect(typeof client.isOffline).toBe('function');
  expect(typeof client.getContext).toBe('function');
  expect(client.logger).toBeDefined();
});

it('isOffline reflects initialConnectionMode', () => {
  const offline = createClient('client-side-id', { kind: 'user', key: 'bob' }, {
    initialConnectionMode: 'offline',
    sendEvents: false,
    diagnosticOptOut: true,
    localStoragePath: tmpRoot,
    logger,
  });
  expect(offline.isOffline()).toBe(true);
  expect(offline.getConnectionMode()).toBe('offline');
});

it('setConnectionMode round-trips to offline', async () => {
  const client = createClient('client-side-id', { kind: 'user', key: 'bob' }, {
    initialConnectionMode: 'offline',
    sendEvents: false,
    diagnosticOptOut: true,
    localStoragePath: tmpRoot,
    logger,
  });

  expect(client.getConnectionMode()).toBe('offline');
  expect(client.isOffline()).toBe(true);

  await client.setConnectionMode('offline');
  expect(client.getConnectionMode()).toBe('offline');
});

it('start completes in offline mode without performing network identify', async () => {
  const client = createClient('client-side-id', { kind: 'user', key: 'bob' }, {
    initialConnectionMode: 'offline',
    sendEvents: false,
    diagnosticOptOut: true,
    localStoragePath: tmpRoot,
    logger,
  });

  const result = await client.start({ timeout: 5 });
  expect(result.status).toBe('complete');
});

// ------ Mobile key routing tests ------

it('uses /mobile/events/diagnostic when useMobileKey is true', () => {
  const mockedFetch = jest.fn();
  (NodePlatform as jest.Mock).mockReturnValue({
    crypto: new NodeCrypto(),
    info: new NodeInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new NodeEncoding(),
    storage: { clear: jest.fn(), get: jest.fn(), set: jest.fn() },
  });
  createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, { useMobileKey: true });

  expect(mockedFetch).toHaveBeenCalledWith(
    'https://events.launchdarkly.com/mobile/events/diagnostic',
    expect.anything(),
  );
});

it('uses /mobile for analytics events when useMobileKey is true', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (NodePlatform as jest.Mock).mockReturnValue({
    crypto: new NodeCrypto(),
    info: new NodeInfo(),
    requests: {
      createEventSource: createMockEventSource,
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new NodeEncoding(),
    storage: { clear: jest.fn(), get: jest.fn(), set: jest.fn() },
  });
  const client = createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    useMobileKey: true,
    diagnosticOptOut: true,
    initialConnectionMode: 'polling',
  });
  await client.start();
  await client.flush();

  expect(mockedFetch).toHaveBeenCalledWith(
    'https://events.launchdarkly.com/mobile',
    expect.anything(),
  );
});

it('uses mobile polling url (/msdk/evalx/contexts/...) when useMobileKey is true', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (NodePlatform as jest.Mock).mockReturnValue({
    crypto: new NodeCrypto(),
    info: new NodeInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new NodeEncoding(),
    storage: { clear: jest.fn(), get: jest.fn(), set: jest.fn() },
  });
  const client = createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    useMobileKey: true,
    diagnosticOptOut: true,
    sendEvents: false,
    initialConnectionMode: 'polling',
  });
  await client.start();

  const regex = /https:\/\/clientsdk\.launchdarkly\.com\/msdk\/evalx\/contexts\/.*/;
  expect(mockedFetch).toHaveBeenCalledWith(expect.stringMatching(regex), expect.anything());
});

it('uses mobile streaming url (/meval/...) when useMobileKey is true', async () => {
  const mockedCreateEventSource = jest.fn((streamUri: string = '', options: any = {}) =>
    createMockEventSourceThatDeliversPut(streamUri, options),
  );
  (NodePlatform as jest.Mock).mockReturnValue({
    crypto: new NodeCrypto(),
    info: new NodeInfo(),
    requests: {
      createEventSource: mockedCreateEventSource,
      fetch: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new NodeEncoding(),
    storage: { clear: jest.fn(), get: jest.fn(), set: jest.fn() },
  });
  const client = createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    useMobileKey: true,
    diagnosticOptOut: true,
    sendEvents: false,
    initialConnectionMode: 'streaming',
  });
  await client.start();

  const regex = /https:\/\/clientstream\.launchdarkly\.com\/meval\/.*/;
  expect(mockedCreateEventSource).toHaveBeenCalledWith(
    expect.stringMatching(regex),
    expect.anything(),
  );
});

it('sends Authorization header with the mobile key on polling', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (NodePlatform as jest.Mock).mockReturnValue({
    crypto: new NodeCrypto(),
    info: new NodeInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new NodeEncoding(),
    storage: { clear: jest.fn(), get: jest.fn(), set: jest.fn() },
  });
  const client = createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    useMobileKey: true,
    diagnosticOptOut: true,
    sendEvents: false,
    initialConnectionMode: 'polling',
  });
  await client.start();

  expect(mockedFetch).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'mobile-key-123' }),
    }),
  );
});

it('sends Authorization header with the mobile key on streaming', async () => {
  const mockedCreateEventSource = jest.fn((streamUri: string = '', options: any = {}) =>
    createMockEventSourceThatDeliversPut(streamUri, options),
  );
  (NodePlatform as jest.Mock).mockReturnValue({
    crypto: new NodeCrypto(),
    info: new NodeInfo(),
    requests: {
      createEventSource: mockedCreateEventSource,
      fetch: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new NodeEncoding(),
    storage: { clear: jest.fn(), get: jest.fn(), set: jest.fn() },
  });
  const client = createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    useMobileKey: true,
    diagnosticOptOut: true,
    sendEvents: false,
    initialConnectionMode: 'streaming',
  });
  await client.start();

  expect(mockedCreateEventSource).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'mobile-key-123' }),
    }),
  );
});

it('sends Authorization header with the mobile key on event posts', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (NodePlatform as jest.Mock).mockReturnValue({
    crypto: new NodeCrypto(),
    info: new NodeInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new NodeEncoding(),
    storage: { clear: jest.fn(), get: jest.fn(), set: jest.fn() },
  });
  const client = createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    useMobileKey: true,
    diagnosticOptOut: true,
    initialConnectionMode: 'polling',
  });
  await client.start();
  await client.flush();

  expect(mockedFetch).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'mobile-key-123' }),
    }),
  );
});

// ------ Client-side ID (default) routing tests ------

it('uses /events/diagnostic/<credential> by default (client-side ID mode)', () => {
  const mockedFetch = jest.fn();
  (NodePlatform as jest.Mock).mockReturnValue({
    crypto: new NodeCrypto(),
    info: new NodeInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new NodeEncoding(),
    storage: { clear: jest.fn(), get: jest.fn(), set: jest.fn() },
  });
  createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {});

  expect(mockedFetch).toHaveBeenCalledWith(
    'https://events.launchdarkly.com/events/diagnostic/client-side-id',
    expect.anything(),
  );
});

it('uses /events/bulk/<credential> for analytics events by default', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (NodePlatform as jest.Mock).mockReturnValue({
    crypto: new NodeCrypto(),
    info: new NodeInfo(),
    requests: {
      createEventSource: createMockEventSource,
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new NodeEncoding(),
    storage: { clear: jest.fn(), get: jest.fn(), set: jest.fn() },
  });
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    diagnosticOptOut: true,
    initialConnectionMode: 'polling',
  });
  await client.start();
  await client.flush();

  expect(mockedFetch).toHaveBeenCalledWith(
    'https://events.launchdarkly.com/events/bulk/client-side-id',
    expect.anything(),
  );
});

it('uses client-side polling url (/sdk/evalx/<credential>/contexts/...) by default', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (NodePlatform as jest.Mock).mockReturnValue({
    crypto: new NodeCrypto(),
    info: new NodeInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new NodeEncoding(),
    storage: { clear: jest.fn(), get: jest.fn(), set: jest.fn() },
  });
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    diagnosticOptOut: true,
    sendEvents: false,
    initialConnectionMode: 'polling',
  });
  await client.start();

  const regex = /https:\/\/clientsdk\.launchdarkly\.com\/sdk\/evalx\/client-side-id\/contexts\/.*/;
  expect(mockedFetch).toHaveBeenCalledWith(expect.stringMatching(regex), expect.anything());
});

it('uses client-side streaming url (/eval/<credential>/...) by default', async () => {
  const mockedCreateEventSource = jest.fn((streamUri: string = '', options: any = {}) =>
    createMockEventSourceThatDeliversPut(streamUri, options),
  );
  (NodePlatform as jest.Mock).mockReturnValue({
    crypto: new NodeCrypto(),
    info: new NodeInfo(),
    requests: {
      createEventSource: mockedCreateEventSource,
      fetch: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new NodeEncoding(),
    storage: { clear: jest.fn(), get: jest.fn(), set: jest.fn() },
  });
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    diagnosticOptOut: true,
    sendEvents: false,
    initialConnectionMode: 'streaming',
  });
  await client.start();

  const regex = /https:\/\/clientstream\.launchdarkly\.com\/eval\/client-side-id\/.*/;
  expect(mockedCreateEventSource).toHaveBeenCalledWith(
    expect.stringMatching(regex),
    expect.anything(),
  );
});

it('sends Authorization header with the client-side ID by default (polling)', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (NodePlatform as jest.Mock).mockReturnValue({
    crypto: new NodeCrypto(),
    info: new NodeInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new NodeEncoding(),
    storage: { clear: jest.fn(), get: jest.fn(), set: jest.fn() },
  });
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    diagnosticOptOut: true,
    sendEvents: false,
    initialConnectionMode: 'polling',
  });
  await client.start();

  expect(mockedFetch).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'client-side-id' }),
    }),
  );
});
