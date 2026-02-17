import type { LDContext, LDLogger, Response } from '@launchdarkly/js-client-sdk-common';

import { ElectronClient } from '../src/ElectronClient';
import { createClient } from '../src/index';
import ElectronCrypto from '../src/platform/ElectronCrypto';
import ElectronEncoding from '../src/platform/ElectronEncoding';
import ElectronInfo from '../src/platform/ElectronInfo';
import ElectronPlatform from '../src/platform/ElectronPlatform';
import { goodBootstrapData } from './testBootstrapData';

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

jest.mock('../src/platform/ElectronPlatform', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  })),
}));

const createMockEventSource = (streamUri: string = '', options: any = {}) => ({
  streamUri,
  options,
  onclose: jest.fn(),
  addEventListener: jest.fn(),
  close: jest.fn(),
});

/** Mock event source that delivers a put event so streaming identify completes. */
const createMockEventSourceThatDeliversPut = (streamUri: string = '', options: any = {}) => ({
  ...createMockEventSource(streamUri, options),
  addEventListener: jest.fn((eventName: string, callback: (e: { data?: string }) => void) => {
    if (eventName === 'put') {
      Promise.resolve().then(() => callback({ data: '{}' }));
    }
  }),
});

const DEFAULT_INITIAL_CONTEXT = { kind: 'user' as const, key: 'bob' };

beforeAll(() => {
  jest.useFakeTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
});

it('uses correct default diagnostic url when using mobile key', () => {
  const mockedFetch = jest.fn();
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
  });

  expect(mockedFetch).toHaveBeenCalledWith(
    'https://events.launchdarkly.com/mobile/events/diagnostic',
    expect.anything(),
  );
  client.close();
});

it('uses correct default analytics event url when using mobile key', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: createMockEventSource,
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
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

it('uses correct default polling url when using mobile key', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    diagnosticOptOut: true,
    sendEvents: false,
    initialConnectionMode: 'polling',
  });
  await client.start();

  const regex = /https:\/\/clientsdk\.launchdarkly\.com\/msdk\/evalx\/contexts\/.*/;
  expect(mockedFetch).toHaveBeenCalledWith(expect.stringMatching(regex), expect.anything());
});

it('uses correct default streaming url when using mobile key', async () => {
  const mockedCreateEventSource = jest.fn((streamUri: string = '', options: any = {}) =>
    createMockEventSourceThatDeliversPut(streamUri, options),
  );
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: mockedCreateEventSource,
      fetch: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
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

it('includes authorization header for polling when using mobile key', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
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

it('includes authorization header for streaming when using mobile key', async () => {
  const mockedCreateEventSource = jest.fn((streamUri: string = '', options: any = {}) =>
    createMockEventSourceThatDeliversPut(streamUri, options),
  );
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: mockedCreateEventSource,
      fetch: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
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

it('includes authorization header for events when using mobile key', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
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

it('uses client-side diagnostic url when useClientSideId is true', () => {
  const mockedFetch = jest.fn();
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    useClientSideId: true,
  });

  expect(mockedFetch).toHaveBeenCalledWith(
    'https://events.launchdarkly.com/events/diagnostic/client-side-id',
    expect.anything(),
  );
  client.close();
});

it('uses client-side analytics event url when useClientSideId is true', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: createMockEventSource,
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    useClientSideId: true,
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

it('uses client-side polling url when useClientSideId is true', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    useClientSideId: true,
    diagnosticOptOut: true,
    sendEvents: false,
    initialConnectionMode: 'polling',
  });
  await client.start();

  const regex = /https:\/\/clientsdk\.launchdarkly\.com\/sdk\/evalx\/client-side-id\/contexts\/.*/;
  expect(mockedFetch).toHaveBeenCalledWith(expect.stringMatching(regex), expect.anything());
});

it('uses client-side streaming url when useClientSideId is true', async () => {
  const mockedCreateEventSource = jest.fn((streamUri: string = '', options: any = {}) =>
    createMockEventSourceThatDeliversPut(streamUri, options),
  );
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: mockedCreateEventSource,
      fetch: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    useClientSideId: true,
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

it('includes authorization header for polling when useClientSideId is true', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    useClientSideId: true,
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

it('includes authorization header for streaming when useClientSideId is true', async () => {
  const mockedCreateEventSource = jest.fn((streamUri: string = '', options: any = {}) =>
    createMockEventSourceThatDeliversPut(streamUri, options),
  );
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: mockedCreateEventSource,
      fetch: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    useClientSideId: true,
    diagnosticOptOut: true,
    sendEvents: false,
    initialConnectionMode: 'streaming',
  });

  await client.start();

  expect(mockedCreateEventSource).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'client-side-id' }),
    }),
  );
});

it('includes authorization header for events when useClientSideId is true', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    useClientSideId: true,
    diagnosticOptOut: true,
    initialConnectionMode: 'polling',
  });
  await client.start();
  await client.flush();

  expect(mockedFetch).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'client-side-id' }),
    }),
  );
});

it('identify with too high of a timeout', async () => {
  const logger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  const client = new ElectronClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    sendEvents: false,
    initialConnectionMode: 'offline',
    logger,
  });
  await client.start();
  client.identify({ key: 'potato', kind: 'user' }, { timeout: 16 });
  expect(logger.warn).toHaveBeenCalledWith(
    'The identify function was called with a timeout greater than 15 seconds. We recommend a timeout of less than 15 seconds.',
  );
});

it('identify timeout equal to threshold', async () => {
  const logger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  const client = new ElectronClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    sendEvents: false,
    initialConnectionMode: 'offline',
    logger,
  });
  await client.start();
  client.identify({ key: 'potato', kind: 'user' }, { timeout: 15 });
  expect(logger.warn).not.toHaveBeenCalled();
});

it('returns error result when identify() is called before start()', async () => {
  const client = createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    initialConnectionMode: 'offline',
  });
  const result = await client.identify({ kind: 'user', key: 'other' });
  expect(result).toBeDefined();
  expect(result.status).toBe('error');
  if (result.status === 'error') {
    expect(result.error.message).toBe('Identify called before start');
  }
});

it('can identify a new context after start() is called', async () => {
  const client = new ElectronClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    initialConnectionMode: 'offline',
  });
  await client.start();
  await client.identify({ kind: 'user', key: 'new-context-key' });
  expect(client.getContext()).toEqual({ kind: 'user', key: 'new-context-key' });
  expect(client.variation('some-flag', 'default')).toBe('default');
});

it('identify() returns completed result when called after start()', async () => {
  const client = createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    initialConnectionMode: 'offline',
  });
  await client.start();
  const result = await client.identify({ kind: 'user', key: 'new-key' });
  expect(result).toEqual({ status: 'completed' });
});

it('can start with an anonymous context as the initial context', async () => {
  const anonymousContext = { anonymous: true, kind: 'user' } as LDContext;
  const client = new ElectronClient('mobile-key-123', anonymousContext, {
    enableIPC: false,
    initialConnectionMode: 'offline',
  });
  await client.start();
  const ctx = client.getContext() as Record<string, unknown> | undefined;
  expect(ctx).toBeDefined();
  expect(ctx?.kind).toBe('user');
  expect(ctx?.anonymous).toBe(true);
  expect(client.variation('some-flag', 'default')).toBe('default');
});

it('can identify an anonymous context after start() is called', async () => {
  const client = new ElectronClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    initialConnectionMode: 'offline',
  });
  await client.start();
  const anonymousContext = { anonymous: true, kind: 'user' } as LDContext;
  await client.identify(anonymousContext);
  const ctx = client.getContext() as Record<string, unknown> | undefined;
  expect(ctx).toBeDefined();
  expect(ctx?.kind).toBe('user');
  expect(ctx?.anonymous).toBe(true);
  expect(client.variation('some-flag', 'default')).toBe('default');
});

it('start() returns same promise when called twice', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: { clear: jest.fn(), get: jest.fn(), set: jest.fn() },
  });
  const client = new ElectronClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    diagnosticOptOut: true,
    initialConnectionMode: 'polling',
  });
  const p1 = client.start();
  const p2 = client.start();
  expect(p1).toBe(p2);
  await p1;
});

it('can get connection mode', () => {
  const client = new ElectronClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    diagnosticOptOut: true,
    initialConnectionMode: 'offline',
  });

  const mode = client.getConnectionMode();
  expect(mode).toEqual('offline');
});

it('can detect if offline', () => {
  const client = new ElectronClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    diagnosticOptOut: true,
    initialConnectionMode: 'offline',
  });

  expect(client.isOffline()).toEqual(true);
});

it('can detect if not offline', () => {
  const client = new ElectronClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    diagnosticOptOut: true,
    initialConnectionMode: 'streaming',
  });

  expect(client.isOffline()).toEqual(false);
});

it('can set connection mode to offline', async () => {
  const client = new ElectronClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    diagnosticOptOut: true,
    initialConnectionMode: 'streaming',
  });

  const setEventSendingEnabled = jest.spyOn(client as any, 'setEventSendingEnabled');
  const setConnectionMode = jest.spyOn((client as any).dataManager, 'setConnectionMode');

  await client.setConnectionMode('offline');

  expect(setEventSendingEnabled).toHaveBeenCalledTimes(1);
  expect(setEventSendingEnabled).toHaveBeenNthCalledWith(1, false, true);

  expect(setConnectionMode).toHaveBeenCalledTimes(1);
  expect(setConnectionMode).toHaveBeenNthCalledWith(1, 'offline');
});

it('can set connection mode to not offline', async () => {
  const client = new ElectronClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    diagnosticOptOut: true,
    initialConnectionMode: 'offline',
  });

  const setEventSendingEnabled = jest.spyOn(client as any, 'setEventSendingEnabled');
  const setConnectionMode = jest.spyOn((client as any).dataManager, 'setConnectionMode');

  await client.setConnectionMode('streaming');

  expect(setConnectionMode).toHaveBeenCalledTimes(1);
  expect(setConnectionMode).toHaveBeenNthCalledWith(1, 'streaming');

  expect(setEventSendingEnabled).toHaveBeenCalledTimes(1);
  expect(setEventSendingEnabled).toHaveBeenNthCalledWith(1, true, false);
});

it('can use bootstrap data with identify', async () => {
  const mockedCreateEventSource = jest.fn((streamUri: string = '', options: any = {}) =>
    createMockEventSource(streamUri, options),
  );
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: mockedCreateEventSource,
      fetch: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    diagnosticOptOut: true,
    sendEvents: false,
    initialConnectionMode: 'streaming',
  });

  await client.start({ bootstrap: goodBootstrapData });

  expect(client.variation('killswitch', false)).toBe(true);
  expect(client.variation('string-flag', '')).toBe('is bob');
  expect(client.boolVariation('cat', true)).toBe(false);
  // After bootstrap we still set up streaming for live updates
  expect(mockedCreateEventSource).toHaveBeenCalled();
});

it('parses bootstrap data only once when identify is called with bootstrap', async () => {
  const commonModule = await import('@launchdarkly/js-client-sdk-common');
  const readFlagsFromBootstrapSpy = jest.spyOn(commonModule, 'readFlagsFromBootstrap');

  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: jest.fn((streamUri: string = '', options: any = {}) =>
        createMockEventSource(streamUri, options),
      ),
      fetch: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    diagnosticOptOut: true,
    sendEvents: false,
    initialConnectionMode: 'streaming',
  });

  await client.start({ bootstrap: goodBootstrapData });

  expect(readFlagsFromBootstrapSpy).toHaveBeenCalledTimes(1);
  expect(readFlagsFromBootstrapSpy).toHaveBeenCalledWith(expect.anything(), goodBootstrapData);
  readFlagsFromBootstrapSpy.mockRestore();
});
