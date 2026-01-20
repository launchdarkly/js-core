import { ipcRenderer } from 'electron';

import type {
  LDContext,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
} from '@launchdarkly/js-client-sdk-common';

import type { LDClientBridge } from '../../src/bridge/LDClientBridge';
import { registerLDClientBridge } from '../../src/bridge/preload';

const clientSideId = 'client-side-id';
let ldClientBridge: (clientSideId: string) => LDClientBridge;

jest.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: jest.fn().mockImplementation((_key: string, api: any) => {
      ldClientBridge = api;
    }),
  },
  ipcRenderer: {
    sendSync: jest.fn(),
    invoke: jest.fn(),
    postMessage: jest.fn(),
  },
}));

const port1Mock = {
  onmessage: null,
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

const getEventName = (baseName: string) => `ld:${clientSideId}:${baseName}`;

beforeEach(() => {
  jest.clearAllMocks();
  port1Mock.onmessage = null;
  port2Mock.onmessage = null;
});

it('registers client bridge successfully', () => {
  registerLDClientBridge();
  expect(ldClientBridge).toBeInstanceOf(Function);
});

describe('given a registered LDClientBridge', () => {
  registerLDClientBridge();
  const bridge = ldClientBridge(clientSideId);

  it('passes allFlags() call through to ipcRenderer', () => {
    (ipcRenderer.sendSync as jest.Mock).mockReturnValueOnce({ flag1: true });

    const result = bridge.allFlags();

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(1, getEventName('allFlags'));
    expect(result).toEqual({ flag1: true });
  });

  it('passes boolVariation() call through to ipcRenderer', () => {
    (ipcRenderer.sendSync as jest.Mock).mockReturnValueOnce(true);

    const result = bridge.boolVariation('flag1', false);

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(
      1,
      getEventName('boolVariation'),
      'flag1',
      false,
    );
    expect(result).toEqual(true);
  });

  it('passes boolVariationDetail() call through to ipcRenderer', () => {
    const expected: LDEvaluationDetailTyped<boolean> = {
      value: true,
      reason: { kind: 'RULE_MATCH' },
    };

    (ipcRenderer.sendSync as jest.Mock).mockReturnValueOnce(expected);

    const result = bridge.boolVariationDetail('flag1', false);

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(
      1,
      getEventName('boolVariationDetail'),
      'flag1',
      false,
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

  it('passes jsonVariation() call through to ipcRenderer', () => {
    const expected = { key1: 'value1', key2: true };

    (ipcRenderer.sendSync as jest.Mock).mockReturnValueOnce(expected);

    const result = bridge.jsonVariation('flag1', {});

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(
      1,
      getEventName('jsonVariation'),
      'flag1',
      {},
    );
    expect(result).toEqual(expected);
  });

  it('passes jsonVariationDetail() call through to ipcRenderer', () => {
    const expected: LDEvaluationDetailTyped<unknown> = {
      value: { key1: 'value1', key2: true },
      reason: { kind: 'RULE_MATCH' },
    };

    (ipcRenderer.sendSync as jest.Mock).mockReturnValueOnce(expected);

    const result = bridge.jsonVariationDetail('flag1', {});

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(
      1,
      getEventName('jsonVariationDetail'),
      'flag1',
      {},
    );
    expect(result).toEqual(expected);
  });

  it('passes numberVariation() call through to ipcRenderer', () => {
    (ipcRenderer.sendSync as jest.Mock).mockReturnValueOnce(1234.5);

    const result = bridge.numberVariation('flag1', 0);

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(
      1,
      getEventName('numberVariation'),
      'flag1',
      0,
    );
    expect(result).toEqual(1234.5);
  });

  it('passes numberVariationDetail() call through to ipcRenderer', () => {
    const expected: LDEvaluationDetailTyped<number> = {
      value: 1234.5,
      reason: { kind: 'RULE_MATCH' },
    };

    (ipcRenderer.sendSync as jest.Mock).mockReturnValueOnce(expected);

    const result = bridge.numberVariationDetail('flag1', 0);

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(
      1,
      getEventName('numberVariationDetail'),
      'flag1',
      0,
    );
    expect(result).toEqual(expected);
  });

  it('passes stringVariation() call through to ipcRenderer', () => {
    (ipcRenderer.sendSync as jest.Mock).mockReturnValueOnce('value');

    const result = bridge.stringVariation('flag1', '');

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(
      1,
      getEventName('stringVariation'),
      'flag1',
      '',
    );
    expect(result).toEqual('value');
  });

  it('passes stringVariationDetail() call through to ipcRenderer', () => {
    const expected: LDEvaluationDetailTyped<string> = {
      value: 'value',
      reason: { kind: 'RULE_MATCH' },
    };

    (ipcRenderer.sendSync as jest.Mock).mockReturnValueOnce(expected);

    const result = bridge.stringVariationDetail('flag1', '');

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(
      1,
      getEventName('stringVariationDetail'),
      'flag1',
      '',
    );
    expect(result).toEqual(expected);
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

  it('passes variation() call through to ipcRenderer', () => {
    (ipcRenderer.sendSync as jest.Mock).mockReturnValueOnce(true);

    const result = bridge.variation('flag1', false);

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(
      1,
      getEventName('variation'),
      'flag1',
      false,
    );
    expect(result).toEqual(true);
  });

  it('passes variationDetail() call through to ipcRenderer', () => {
    const expected: LDEvaluationDetail = {
      value: true,
      reason: { kind: 'RULE_MATCH' },
    };

    (ipcRenderer.sendSync as jest.Mock).mockReturnValueOnce(expected);

    const result = bridge.variationDetail('flag1', false);

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(
      1,
      getEventName('variationDetail'),
      'flag1',
      false,
    );
    expect(result).toEqual(expected);
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

    const result = bridge.removeEventHandler('event1', 'callback-id-1');

    expect(ipcRenderer.sendSync).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.sendSync).toHaveBeenNthCalledWith(
      1,
      getEventName('removeEventHandler'),
      'event1',
      'callback-id-1',
    );
    expect(result).toEqual(true);
  });
});
