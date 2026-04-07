import { ipcRenderer } from 'electron';

import '../../src/bridge';
import type { LDClientBridge } from '../../src/bridge/LDClientBridge';
import { deriveNamespace } from '../../src/deriveNamespace';
import type { LDContext } from '../../src/index';

const clientSideId = 'client-side-id';
let ldClientBridge: (namespace: string) => LDClientBridge;

jest.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: jest.fn().mockImplementation((_key: string, api: any) => {
      (globalThis as any).ldBridgeCapture = { ldClientBridge: api };
    }),
  },
  ipcRenderer: {
    send: jest.fn(),
    sendSync: jest.fn(),
    invoke: jest.fn(),
    postMessage: jest.fn(),
  },
}));

beforeAll(() => {
  ldClientBridge = (globalThis as any).ldBridgeCapture.ldClientBridge;
});

const port1Mock = {
  onmessage: null,
  onclose: null as (() => void) | null,
  postMessage: jest.fn(),
  addEventListener: jest.fn(),
};

const port2Mock = {
  onmessage: null,
  postMessage: jest.fn(),
  addEventListener: jest.fn(),
};

globalThis.MessageChannel = jest.fn().mockImplementation(() => ({
  port1: port1Mock,
  port2: port2Mock,
}));

const getEventName = (baseName: string) => `ld:${deriveNamespace(clientSideId)}:${baseName}`;

beforeEach(() => {
  jest.clearAllMocks();
  port1Mock.onmessage = null;
  port1Mock.onclose = null;
  port2Mock.onmessage = null;
});

it('registers client bridge successfully', () => {
  expect(ldClientBridge).toBeInstanceOf(Function);
});

describe('given a registered LDClientBridge', () => {
  let bridge: LDClientBridge;

  beforeEach(() => {
    bridge = ldClientBridge(deriveNamespace(clientSideId));
  });

  it('passes allFlags() call through to ipcRenderer', () => {
    (ipcRenderer.sendSync as jest.Mock).mockReturnValueOnce({ flag1: true });

    const result = bridge.allFlags();

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(1, getEventName('allFlags'));
    expect(result).toEqual({ flag1: true });
  });

  it.each([
    ['boolVariation', true, false],
    ['boolVariationDetail', { value: true, reason: { kind: 'RULE_MATCH' } }, false],
    ['numberVariation', 1234.5, 0],
    ['numberVariationDetail', { value: 1234.5, reason: { kind: 'RULE_MATCH' } }, 0],
    ['stringVariation', 'value', ''],
    ['stringVariationDetail', { value: 'value', reason: { kind: 'RULE_MATCH' } }, ''],
    ['jsonVariation', { key1: 'value1' }, {}],
    ['jsonVariationDetail', { value: { key1: 'value1' }, reason: { kind: 'RULE_MATCH' } }, {}],
    ['variation', true, false],
    ['variationDetail', { value: true, reason: { kind: 'RULE_MATCH' } }, false],
  ])('passes %s() call through to ipcRenderer', (method, expected, defaultValue) => {
    (ipcRenderer.sendSync as jest.Mock).mockReturnValueOnce(expected);

    const result = (bridge as any)[method]('flag1', defaultValue);

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(
      1,
      getEventName(method),
      'flag1',
      defaultValue,
    );
    expect(result).toEqual(expected);
  });

  it('passes flush() call through to ipcRenderer', async () => {
    (ipcRenderer.invoke as jest.Mock).mockResolvedValueOnce({ result: true });

    const result = await bridge.flush();

    expect(ipcRenderer.invoke).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.invoke).toHaveBeenNthCalledWith(1, getEventName('flush'));
    expect(result).toEqual({ result: true });
  });

  it('passes getContext() call through to ipcRenderer', () => {
    const expected: LDContext = { kind: 'user', key: 'test-user-id' };

    (ipcRenderer.sendSync as jest.Mock).mockReturnValueOnce(expected);

    const result = bridge.getContext();

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(1, getEventName('getContext'));
    expect(result).toEqual(expected);
  });

  it('passes identify() call through to ipcRenderer', async () => {
    const context: LDContext = { kind: 'user', key: 'test-user-id' };

    await bridge.identify(context, { waitForNetworkResults: true });

    expect(ipcRenderer.invoke).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.invoke).toHaveBeenNthCalledWith(1, getEventName('identify'), context, {
      waitForNetworkResults: true,
    });
  });

  it('passes track() call through to ipcRenderer', () => {
    bridge.track('event1', { key1: 'value1' }, 1234.5);

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(
      1,
      getEventName('track'),
      'event1',
      { key1: 'value1' },
      1234.5,
    );
  });

  it('passes setConnectionMode() call through to ipcRenderer', async () => {
    await bridge.setConnectionMode('streaming');

    expect(ipcRenderer.invoke).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.invoke).toHaveBeenNthCalledWith(
      1,
      getEventName('setConnectionMode'),
      'streaming',
    );
  });

  it('passes getConnectionMode() call through to ipcRenderer', () => {
    (ipcRenderer.sendSync as jest.Mock).mockReturnValueOnce('streaming');

    const result = bridge.getConnectionMode();

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(1, getEventName('getConnectionMode'));
    expect(result).toEqual('streaming');
  });

  it('passes isOffline() call through to ipcRenderer', () => {
    (ipcRenderer.sendSync as jest.Mock).mockReturnValueOnce(true);

    const result = bridge.isOffline();

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(1, getEventName('isOffline'));
    expect(result).toEqual(true);
  });

  it('registers callback with addHandler()', () => {
    const callback = jest.fn();

    const result = bridge.addEventHandler('event1', callback);

    expect(ipcRenderer.postMessage).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.postMessage).toHaveBeenNthCalledWith(
      1,
      getEventName('addEventHandler'),
      { eventName: 'event1', callbackId: result },
      [port2Mock],
    );
    expect(result).toEqual(expect.any(String));

    (port1Mock.onmessage as any)?.({ data: ['arg1', 'arg2', 'arg3'] });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenNthCalledWith(1, 'arg1', 'arg2', 'arg3');
  });

  it('unregisters callback with removeHandler()', () => {
    (ipcRenderer.sendSync as jest.Mock).mockReturnValueOnce(true);

    const result = bridge.removeEventHandler('callback-id-1');

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(
      1,
      getEventName('removeEventHandler'),
      'callback-id-1',
    );
    expect(result).toEqual(true);
  });

  it('sends log warning and returns fallback when sendSync throws', () => {
    const error = new Error('Could not clone');
    (ipcRenderer.sendSync as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    const defaultValue = { key: 'default' };
    const result = bridge.jsonVariation('flag1', defaultValue);

    expect(result).toEqual(defaultValue);
    expect(ipcRenderer.send).toHaveBeenCalledWith(
      getEventName('log'),
      'warn',
      expect.stringContaining('Could not clone'),
    );
  });

  it('returns well-formed detail on error for variationDetail', () => {
    (ipcRenderer.sendSync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('clone failed');
    });

    const result = bridge.variationDetail('flag1', 'fallback');

    expect(result).toEqual({
      value: 'fallback',
      reason: { kind: 'ERROR', errorKind: 'EXCEPTION' },
    });
  });

  it('invokes optional onClose when the message port is closed', () => {
    const callback = jest.fn();
    const onClose = jest.fn();

    bridge.addEventHandler('event1', callback, onClose);

    expect(port1Mock.onclose).toBeDefined();
    port1Mock.onclose?.();

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
