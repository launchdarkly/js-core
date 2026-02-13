import type {
  LDContext,
  LDIdentifyOptions,
  LDLogger,
  Response,
} from '@launchdarkly/js-client-sdk-common';

import { ElectronClient } from '../src/ElectronClient';
import { createClient } from '../src/index';
import ElectronCrypto from '../src/platform/ElectronCrypto';
import ElectronEncoding from '../src/platform/ElectronEncoding';
import ElectronInfo from '../src/platform/ElectronInfo';
import ElectronPlatform from '../src/platform/ElectronPlatform';
import { goodBootstrapData, remoteFlagsMockData } from './testBootstrapData';

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

const createMockEventSource = (streamUri: string = '', options: Record<string, unknown> = {}) => ({
  streamUri,
  options,
  onclose: jest.fn(),
  addEventListener: jest.fn(),
  close: jest.fn(),
});

/** Mock event source that delivers a put event with the given flag data so streaming identify completes. */
function createMockEventSourceThatDeliversPut(putData: object) {
  const putPayload = JSON.stringify(putData);
  return (streamUri: string = '', options: Record<string, unknown> = {}) => ({
    ...createMockEventSource(streamUri, options),
    addEventListener: jest.fn((eventName: string, callback: (e: { data?: string }) => void) => {
      if (eventName === 'put') {
        Promise.resolve().then(() => callback({ data: putPayload }));
      }
    }),
  });
}

const handlers = new Map<string, Function>();
const mockOn = jest.fn((eventName: string, handler: Function) => {
  handlers.set(eventName, handler);
});
const mockHandle = jest.fn((eventName: string, handler: Function) => {
  handlers.set(eventName, handler);
});

jest.mock('electron', () => ({
  ipcMain: {
    on: (eventName: string, handler: Function) => mockOn(eventName, handler),
    handle: (eventName: string, handler: Function) => mockHandle(eventName, handler),
    getHandler: (eventName: string) => handlers.get(eventName),
    removeAllListeners: (channel: string) => handlers.delete(channel),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));

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

const clientSideId = 'client-side-id';
const DEFAULT_INITIAL_CONTEXT = { kind: 'user' as const, key: 'test-user' };

beforeEach(() => {
  jest.clearAllMocks();
  handlers.clear();
});

describe('given an initialized ElectronClient with enableIPC: false', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const client = createClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
    initialConnectionMode: 'offline',
    enableIPC: false,
    logger,
    diagnosticOptOut: true,
  });

  beforeAll(async () => {
    await client.start();
  });

  it('does not register any IPC channels so ipcMain.on and ipcMain.handle are never called', () => {
    expect(mockOn).not.toHaveBeenCalled();
    expect(mockHandle).not.toHaveBeenCalled();
  });

  it('evaluates allFlags() when called directly on the client', () => {
    const result = client.allFlags();
    expect(result).toEqual({});
  });

  it('evaluates boolVariation() when called directly on the client', () => {
    const result = client.boolVariation('flag1', false);
    expect(result).toBe(false);
  });

  it('evaluates boolVariationDetail() when called directly on the client', () => {
    const result = client.boolVariationDetail('flag1', false);
    expect(result.value).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('evaluates flush() when called directly on the client', async () => {
    const result = await client.flush();
    expect(result).toBeDefined();
    expect(result).toHaveProperty('result');
  });

  it('evaluates getContext() when called directly on the client', () => {
    const result = client.getContext();
    expect(result).toEqual(DEFAULT_INITIAL_CONTEXT);
  });

  it('evaluates identify() when called directly on the client', async () => {
    const context: LDContext = { kind: 'user', key: 'test-user-id' };
    const options: LDIdentifyOptions = { waitForNetworkResults: true };
    const result = await client.identify(context, options);
    expect(result.status).toBe('completed');
    expect(client.getContext()).toEqual(context);
  });

  it('evaluates variation, detail, connection mode, and track when called directly on the client', async () => {
    expect(client.jsonVariation('flag1', {})).toEqual({});
    expect(client.jsonVariationDetail('flag1', {}).value).toEqual({});
    expect(client.jsonVariationDetail('flag1', {}).reason).toBeDefined();

    expect(client.numberVariation('flag1', 0)).toBe(0);
    expect(client.numberVariationDetail('flag1', 0).value).toBe(0);
    expect(client.numberVariationDetail('flag1', 0).reason).toBeDefined();

    expect(client.stringVariation('flag1', '')).toBe('');
    expect(client.stringVariationDetail('flag1', '').value).toBe('');
    expect(client.stringVariationDetail('flag1', '').reason).toBeDefined();

    expect(() => client.track('event1', { key1: 'value1' }, 1234.5)).not.toThrow();

    expect(client.variation('flag1', false)).toBe(false);
    expect(client.variationDetail('flag1', false).value).toBe(false);
    expect(client.variationDetail('flag1', false).reason).toBeDefined();

    expect(client.getConnectionMode()).toBe('offline');
    expect(client.isOffline()).toBe(true);
    await expect(client.setConnectionMode('offline')).resolves.not.toThrow();
  });
});

describe('given an initialized ElectronClient with enableIPC: false and bootstrap data', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  it('evaluates flags from bootstrap when called directly on the client', async () => {
    const client = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      initialConnectionMode: 'offline',
      enableIPC: false,
      logger,
      diagnosticOptOut: true,
    });
    await client.start({ bootstrap: goodBootstrapData });

    expect(client.variation('killswitch', false)).toBe(true);
    expect(client.stringVariation('string-flag', '')).toBe('is bob');
    expect(client.boolVariation('cat', true)).toBe(false);
    expect(client.allFlags()).toMatchObject({
      killswitch: true,
      'string-flag': 'is bob',
      cat: false,
    });
  });
});

describe('enableIPC: false and close()', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  it('does not register channels so close() does not remove any handlers', async () => {
    const client = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      initialConnectionMode: 'offline',
      enableIPC: false,
      logger,
      diagnosticOptOut: true,
    });
    await client.start();

    expect(mockOn).not.toHaveBeenCalled();
    expect(mockHandle).not.toHaveBeenCalled();

    await client.close();

    expect(mockOn).not.toHaveBeenCalled();
    expect(mockHandle).not.toHaveBeenCalled();
  });
});

describe('given an initialized ElectronClient with enableIPC: false and polling', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  it('evaluates flags from polling response when called directly on the client', async () => {
    const mockedFetch = mockFetch(JSON.stringify(remoteFlagsMockData), 200);
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

    const client = createClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      initialConnectionMode: 'polling',
      enableIPC: false,
      logger,
      diagnosticOptOut: true,
      sendEvents: false,
    });
    await client.start();

    expect(client.boolVariation('on-off-flag', false)).toBe(true);
    expect(client.stringVariation('string-flag', '')).toBe('from-remote');
    expect(client.numberVariation('number-flag', 0)).toBe(100);
    expect(client.jsonVariation('json-flag', {})).toEqual({ key: 'value', count: 5 });
    expect(client.allFlags()).toMatchObject({
      'on-off-flag': true,
      'string-flag': 'from-remote',
      'number-flag': 100,
      'json-flag': { key: 'value', count: 5 },
    });
  });
});

describe('given an initialized ElectronClient with enableIPC: false and streaming', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  it('evaluates flags from streaming put when called directly on the client', async () => {
    const mockedCreateEventSource = jest.fn(
      createMockEventSourceThatDeliversPut(remoteFlagsMockData),
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

    const client = createClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      initialConnectionMode: 'streaming',
      enableIPC: false,
      logger,
      diagnosticOptOut: true,
      sendEvents: false,
    });
    await client.start();

    expect(client.boolVariation('on-off-flag', false)).toBe(true);
    expect(client.stringVariation('string-flag', '')).toBe('from-remote');
    expect(client.numberVariation('number-flag', 0)).toBe(100);
    expect(client.jsonVariation('json-flag', {})).toEqual({ key: 'value', count: 5 });
    expect(client.allFlags()).toMatchObject({
      'on-off-flag': true,
      'string-flag': 'from-remote',
      'number-flag': 100,
      'json-flag': { key: 'value', count: 5 },
    });
  });
});
