import { ipcMain } from 'electron';
import type { IpcMain } from 'electron';

import type { LDContext, LDLogger } from '@launchdarkly/node-client-sdk';
import { createClient as createBaseClient } from '@launchdarkly/node-client-sdk';

import { makeClient } from '../src/ElectronClient';
import { deriveNamespace, getIPCChannelName } from '../src/ElectronIPC';

type MockIpcMain = IpcMain & {
  getHandler: (eventName: string) => ((...args: any[]) => any) | undefined;
};
type MockPort = { postMessage: (...args: any[]) => void; close: (...args: any[]) => void };
type MockIpcEvent = { returnValue?: any; ports?: MockPort[] };

jest.mock('electron', () => {
  const handlers = new Map<string, (...args: any[]) => any>();
  return {
    ipcMain: {
      on: (eventName: string, handler: (...args: any[]) => any) => handlers.set(eventName, handler),
      handle: (eventName: string, handler: (...args: any[]) => any) =>
        handlers.set(eventName, handler),
      getHandler: (eventName: string) => handlers.get(eventName),
      removeAllListeners: (channel: string) => handlers.delete(channel),
      removeHandler: (channel: string) => handlers.delete(channel),
    },
    app: { getPath: () => '/tmp/ld-electron-test-userdata' },
  };
});

const mockLogger: LDLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

// The stubbed node-client-sdk base client. Event listeners registered via on() are captured so we
// can invoke the broadcast callback in the event-subscription tests.
const baseClientListeners = new Map<string, Array<(...args: any[]) => void>>();

function makeMockBaseClient() {
  baseClientListeners.clear();
  return {
    logger: mockLogger,
    allFlags: jest.fn(() => ({})),
    variation: jest.fn(),
    variationDetail: jest.fn(),
    boolVariation: jest.fn(),
    boolVariationDetail: jest.fn(),
    numberVariation: jest.fn(),
    numberVariationDetail: jest.fn(),
    stringVariation: jest.fn(),
    stringVariationDetail: jest.fn(),
    jsonVariation: jest.fn(),
    jsonVariationDetail: jest.fn(),
    track: jest.fn(),
    on: jest.fn((eventName: string, cb: (...args: any[]) => void) => {
      const arr = baseClientListeners.get(eventName) ?? [];
      arr.push(cb);
      baseClientListeners.set(eventName, arr);
    }),
    off: jest.fn(),
    flush: jest.fn(async () => ({ result: true })),
    identify: jest.fn(async () => ({ status: 'completed' })),
    getContext: jest.fn(() => ({ kind: 'user', key: 'test-user' })),
    close: jest.fn(async () => {}),
    addHook: jest.fn(),
    waitForInitialization: jest.fn(async () => ({ status: 'completed' })),
    start: jest.fn(async () => ({ status: 'completed' })),
    setConnectionMode: jest.fn(async () => {}),
    getConnectionMode: jest.fn(() => 'streaming'),
    isOffline: jest.fn(() => false),
  };
}

let mockBaseClient = makeMockBaseClient();

jest.mock('@launchdarkly/node-client-sdk', () => ({
  __esModule: true,
  createClient: jest.fn(() => mockBaseClient),
  basicLogger: jest.fn(() => mockLogger),
}));

const clientSideId = 'client-side-id';
const mockIpcMain = ipcMain as MockIpcMain;
const getEventName = (baseName: Parameters<typeof getIPCChannelName>[1]) =>
  getIPCChannelName(deriveNamespace(clientSideId), baseName);
const DEFAULT_INITIAL_CONTEXT: LDContext = { kind: 'user', key: 'test-user' };

beforeEach(() => {
  jest.clearAllMocks();
  mockBaseClient = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mockBaseClient);
});

describe('given a client created with IPC enabled', () => {
  beforeEach(() => {
    // Constructing the client registers the IPC handlers under test; we assert against the mock
    // base client and the ipcMain handler registry, not the returned instance.
    makeClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      initialConnectionMode: 'offline',
      enableIPC: true,
      logger: mockLogger,
      diagnosticOptOut: true,
    });
  });

  it('delegates allFlags() to the base client and sets returnValue', () => {
    mockBaseClient.allFlags.mockReturnValueOnce({ flag1: 'value1', flag2: true });
    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('allFlags'))?.(event);
    expect(mockBaseClient.allFlags).toHaveBeenCalledTimes(1);
    expect(event.returnValue).toEqual({ flag1: 'value1', flag2: true });
  });

  it('delegates boolVariation() with args and sets returnValue', () => {
    mockBaseClient.boolVariation.mockReturnValueOnce(true);
    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('boolVariation'))?.(event, 'flag1', false);
    expect(mockBaseClient.boolVariation).toHaveBeenCalledWith('flag1', false);
    expect(event.returnValue).toBe(true);
  });

  it('delegates the remaining sync variation channels and sets returnValue', () => {
    const cases: Array<[Parameters<typeof getIPCChannelName>[1], keyof typeof mockBaseClient, any]> = [
      ['boolVariationDetail', 'boolVariationDetail', { value: true, reason: { kind: 'OFF' } }],
      ['numberVariation', 'numberVariation', 1234.5],
      ['numberVariationDetail', 'numberVariationDetail', { value: 1, reason: { kind: 'OFF' } }],
      ['stringVariation', 'stringVariation', 'value'],
      ['stringVariationDetail', 'stringVariationDetail', { value: 'v', reason: { kind: 'OFF' } }],
      ['jsonVariation', 'jsonVariation', { a: 1 }],
      ['jsonVariationDetail', 'jsonVariationDetail', { value: { a: 1 }, reason: { kind: 'OFF' } }],
      ['variation', 'variation', true],
      ['variationDetail', 'variationDetail', { value: true, reason: { kind: 'OFF' } }],
    ];
    cases.forEach(([channel, method, expected]) => {
      (mockBaseClient[method] as jest.Mock).mockReturnValueOnce(expected);
      const event: MockIpcEvent = {};
      mockIpcMain.getHandler(getEventName(channel))?.(event, 'flag1', 'default');
      expect(mockBaseClient[method]).toHaveBeenCalledWith('flag1', 'default');
      expect(event.returnValue).toEqual(expected);
    });
  });

  it('delegates track() and getContext()', () => {
    const trackEvent: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('track'))?.(trackEvent, 'e1', { k: 'v' }, 42);
    expect(mockBaseClient.track).toHaveBeenCalledWith('e1', { k: 'v' }, 42);

    mockBaseClient.getContext.mockReturnValueOnce({ kind: 'user', key: 'ctx' });
    const ctxEvent: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('getContext'))?.(ctxEvent);
    expect(ctxEvent.returnValue).toEqual({ kind: 'user', key: 'ctx' });
  });

  it('delegates connection-mode channels', async () => {
    await mockIpcMain.getHandler(getEventName('setConnectionMode'))?.({}, 'streaming');
    expect(mockBaseClient.setConnectionMode).toHaveBeenCalledWith('streaming');

    mockBaseClient.getConnectionMode.mockReturnValueOnce('polling');
    const modeEvent: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('getConnectionMode'))?.(modeEvent);
    expect(modeEvent.returnValue).toBe('polling');

    mockBaseClient.isOffline.mockReturnValueOnce(true);
    const offlineEvent: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('isOffline'))?.(offlineEvent);
    expect(offlineEvent.returnValue).toBe(true);
  });

  it('delegates the async channels flush/identify/waitForInitialization', async () => {
    const flushed = await mockIpcMain.getHandler(getEventName('flush'))?.({});
    expect(mockBaseClient.flush).toHaveBeenCalledTimes(1);
    expect(flushed).toEqual({ result: true });

    const context: LDContext = { kind: 'user', key: 'id' };
    const identifyResult = await mockIpcMain
      .getHandler(getEventName('identify'))
      ?.({}, context, { waitForNetworkResults: true });
    expect(mockBaseClient.identify).toHaveBeenCalledWith(context, { waitForNetworkResults: true });
    expect(identifyResult).toEqual({ status: 'completed' });

    await mockIpcMain.getHandler(getEventName('waitForInitialization'))?.({}, { timeout: 5 });
    expect(mockBaseClient.waitForInitialization).toHaveBeenCalledWith({ timeout: 5 });
  });

  it('dispatches log() to the matching logger method and ignores invalid levels', () => {
    mockIpcMain.getHandler(getEventName('log'))?.({}, 'warn', 'a warning');
    expect(mockLogger.warn).toHaveBeenCalledWith('a warning');
    mockIpcMain.getHandler(getEventName('log'))?.({}, 'invalid', 'ignored');
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('registers a single base-client listener per event and broadcasts to all ports', () => {
    const port1: MockPort = { postMessage: jest.fn(), close: jest.fn() };
    const port2: MockPort = { postMessage: jest.fn(), close: jest.fn() };
    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(
      { ports: [port1] } as MockIpcEvent,
      { callbackId: 'sub1', eventName: 'change' },
    );
    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(
      { ports: [port2] } as MockIpcEvent,
      { callbackId: 'sub2', eventName: 'change' },
    );
    expect(mockBaseClient.on).toHaveBeenCalledTimes(1);
    expect(mockBaseClient.on).toHaveBeenCalledWith('change', expect.any(Function));

    const broadcast = baseClientListeners.get('change')![0];
    broadcast('arg1', 'arg2');
    expect(port1.postMessage).toHaveBeenCalledWith(['arg1', 'arg2']);
    expect(port2.postMessage).toHaveBeenCalledWith(['arg1', 'arg2']);
  });

  it('keeps broadcasting to live ports when one port throws', () => {
    const deadPort: MockPort = {
      postMessage: jest.fn(() => {
        throw new Error('ERR_CLOSED_MESSAGE_PORT');
      }),
      close: jest.fn(),
    };
    const livePort: MockPort = { postMessage: jest.fn(), close: jest.fn() };
    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(
      { ports: [deadPort] } as MockIpcEvent,
      { callbackId: 'dead', eventName: 'change' },
    );
    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(
      { ports: [livePort] } as MockIpcEvent,
      { callbackId: 'live', eventName: 'change' },
    );
    const broadcast = baseClientListeners.get('change')![0];
    broadcast('x');
    expect(livePort.postMessage).toHaveBeenCalledWith(['x']);
    expect(mockLogger.warn).toHaveBeenCalledWith('Event change broadcast failed');
  });

  it('returns false from removeEventHandler for an unknown callbackId and does not call off()', () => {
    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('removeEventHandler'))?.(event, 'unknown');
    expect(mockBaseClient.off).not.toHaveBeenCalled();
    expect(event.returnValue).toBe(false);
  });

  it('removes the listener and closes the port on removeEventHandler for a known callbackId', () => {
    const port: MockPort = { postMessage: jest.fn(), close: jest.fn() };
    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(
      { ports: [port] } as MockIpcEvent,
      { callbackId: 'cb1', eventName: 'change' },
    );
    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('removeEventHandler'))?.(event, 'cb1');
    expect(mockBaseClient.off).toHaveBeenCalledWith('change', expect.any(Function));
    expect(port.close).toHaveBeenCalledTimes(1);
    expect(event.returnValue).toBe(true);
  });

  it('registers when addEventHandler arrives after a no-op removeEventHandler for the same id', () => {
    const port: MockPort = { postMessage: jest.fn(), close: jest.fn() };
    const removeEvent: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('removeEventHandler'))?.(removeEvent, 'race-id');
    expect(removeEvent.returnValue).toBe(false);
    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(
      { ports: [port] } as MockIpcEvent,
      { callbackId: 'race-id', eventName: 'change' },
    );
    expect(mockBaseClient.on).toHaveBeenCalledTimes(1);
    expect(port.close).not.toHaveBeenCalled();
  });
});

describe('close()', () => {
  it('removes all registered channels and closes ports, and is idempotent', async () => {
    const client = makeClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      initialConnectionMode: 'offline',
      enableIPC: true,
      logger: mockLogger,
      diagnosticOptOut: true,
    });
    expect(mockIpcMain.getHandler(getEventName('allFlags'))).toBeDefined();

    const port: MockPort = { postMessage: jest.fn(), close: jest.fn() };
    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(
      { ports: [port] } as MockIpcEvent,
      { callbackId: 'cb1', eventName: 'change' },
    );

    await client.close();
    expect(mockBaseClient.close).toHaveBeenCalledTimes(1);
    expect(mockIpcMain.getHandler(getEventName('allFlags'))).toBeUndefined();
    expect(mockIpcMain.getHandler(getEventName('flush'))).toBeUndefined();
    expect(port.close).toHaveBeenCalled();

    await expect(client.close()).resolves.not.toThrow();
  });
});
