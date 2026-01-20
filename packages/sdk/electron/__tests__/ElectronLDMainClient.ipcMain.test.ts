import { ipcMain } from 'electron';
import type { IpcMain } from 'electron';

import type {
  LDContext,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDIdentifyOptions,
  LDLogger,
} from '@launchdarkly/js-client-sdk-common';

import { ElectronLDMainClient } from '../src/ElectronLDMainClient';
import ElectronCrypto from '../src/platform/ElectronCrypto';
import ElectronEncoding from '../src/platform/ElectronEncoding';
import ElectronInfo from '../src/platform/ElectronInfo';

type MockIpcMain = IpcMain & { getHandler: (eventName: string) => Function };
type MockPort = { postMessage: Function; close: Function };
type MockIpcEvent = { returnValue?: any; ports?: MockPort[] };

jest.mock('electron', () => {
  const handlers = new Map<string, Function>();
  return {
    ipcMain: {
      on: (eventName: string, handler: Function) => handlers.set(eventName, handler),
      handle: (eventName: string, handler: Function) => handlers.set(eventName, handler),
      getHandler: (eventName: string) => handlers.get(eventName),
    },
  };
});

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
const mockIpcMain: MockIpcMain = ipcMain as MockIpcMain;
const mockPort: MockPort = {
  postMessage: jest.fn(),
  close: jest.fn(),
};

const getEventName = (baseName: string) => `ld:${clientSideId}:${baseName}`;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('given an initialized ElectronLDMainClient', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const client = new ElectronLDMainClient(clientSideId, {
    initialConnectionMode: 'offline',
    registerInMain: true,
    logger,
    diagnosticOptOut: true,
  });

  it('handles allFlags() call', () => {
    const spy = jest.spyOn(client, 'allFlags');
    spy.mockReturnValueOnce({ flag1: 'value1', flag2: true });

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('allFlags'))?.(event);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(event.returnValue).toEqual({ flag1: 'value1', flag2: true });
  });

  it('handles boolVariaion() call', () => {
    const spy = jest.spyOn(client, 'boolVariation');
    spy.mockReturnValueOnce(true);

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('boolVariation'))?.(event, 'flag1', false);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenNthCalledWith(1, 'flag1', false);
    expect(event.returnValue).toEqual(true);
  });

  it('handles boolVariationDetail() call', () => {
    const expected: LDEvaluationDetailTyped<boolean> = {
      value: true,
      reason: { kind: 'RULE_MATCH' },
    };

    const spy = jest.spyOn(client, 'boolVariationDetail');
    spy.mockReturnValueOnce(expected);

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('boolVariationDetail'))?.(event, 'flag1', false);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenNthCalledWith(1, 'flag1', false);
    expect(event.returnValue).toEqual(expected);
  });

  it('handles flush() call', async () => {
    const spy = jest.spyOn(client, 'flush');
    spy.mockResolvedValueOnce({ result: true });

    const result = await mockIpcMain.getHandler(getEventName('flush'))?.({});

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ result: true });
  });

  it('handles getContext() call', () => {
    const expected: LDContext = { kind: 'user', key: 'test-user-id' };

    const spy = jest.spyOn(client, 'getContext');
    spy.mockReturnValueOnce(expected);

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('getContext'))?.(event);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(event.returnValue).toEqual(expected);
  });

  it('handles identify() call', async () => {
    const context: LDContext = { kind: 'user', key: 'test-user-id' };
    const options: LDIdentifyOptions = { waitForNetworkResults: true };

    const spy = jest.spyOn(client, 'identify');
    spy.mockResolvedValueOnce();

    await mockIpcMain.getHandler(getEventName('identify'))?.({}, context, options);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenNthCalledWith(1, context, options);
  });

  it('handles jsonVariation() call', () => {
    const expected = { key1: 'value', key2: true };

    const spy = jest.spyOn(client, 'jsonVariation');
    spy.mockReturnValueOnce(expected);

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('jsonVariation'))?.(event, 'flag1', {});

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenNthCalledWith(1, 'flag1', {});
    expect(event.returnValue).toEqual(expected);
  });

  it('handles jsonVariationDetail() call', () => {
    const expected: LDEvaluationDetailTyped<unknown> = {
      value: { key1: 'value', key2: true },
      reason: { kind: 'RULE_MATCH' },
    };

    const spy = jest.spyOn(client, 'jsonVariationDetail');
    spy.mockReturnValueOnce(expected);

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('jsonVariationDetail'))?.(event, 'flag1', {});

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenNthCalledWith(1, 'flag1', {});
    expect(event.returnValue).toEqual(expected);
  });

  it('handles numberVariation() call', () => {
    const spy = jest.spyOn(client, 'numberVariation');
    spy.mockReturnValueOnce(1234.5);

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('numberVariation'))?.(event, 'flag1', 0);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenNthCalledWith(1, 'flag1', 0);
    expect(event.returnValue).toEqual(1234.5);
  });

  it('handles numberVariationDetail() call', () => {
    const expected: LDEvaluationDetailTyped<number> = {
      value: 1234.5,
      reason: { kind: 'RULE_MATCH' },
    };

    const spy = jest.spyOn(client, 'numberVariationDetail');
    spy.mockReturnValueOnce(expected);

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('numberVariationDetail'))?.(event, 'flag1', 0);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenNthCalledWith(1, 'flag1', 0);
    expect(event.returnValue).toEqual(expected);
  });

  it('handles stringVariation() call', () => {
    const spy = jest.spyOn(client, 'stringVariation');
    spy.mockReturnValueOnce('value');

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('stringVariation'))?.(event, 'flag1', '');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenNthCalledWith(1, 'flag1', '');
    expect(event.returnValue).toEqual('value');
  });

  it('handles stringVariationDetail() call', () => {
    const expected: LDEvaluationDetailTyped<string> = {
      value: 'value',
      reason: { kind: 'RULE_MATCH' },
    };

    const spy = jest.spyOn(client, 'stringVariationDetail');
    spy.mockReturnValueOnce(expected);

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('stringVariationDetail'))?.(event, 'flag1', '');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenNthCalledWith(1, 'flag1', '');
    expect(event.returnValue).toEqual(expected);
  });

  it('handles track() call', () => {
    const spy = jest.spyOn(client, 'track');
    spy.mockReturnValueOnce();

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('track'))?.(event, 'event1', { key1: 'value1' }, 1234.5);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenNthCalledWith(1, 'event1', { key1: 'value1' }, 1234.5);
    expect(event.returnValue).toBeUndefined();
  });

  it('handles variation() call', () => {
    const spy = jest.spyOn(client, 'variation');
    spy.mockReturnValueOnce(true);

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('variation'))?.(event, 'flag1', false);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenNthCalledWith(1, 'flag1', false);
    expect(event.returnValue).toEqual(true);
  });

  it('handles variationDetail() call', () => {
    const expected: LDEvaluationDetail = {
      value: true,
      reason: { kind: 'RULE_MATCH' },
    };

    const spy = jest.spyOn(client, 'variationDetail');
    spy.mockReturnValueOnce(expected);

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('variationDetail'))?.(event, 'flag1', false);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenNthCalledWith(1, 'flag1', false);
    expect(event.returnValue).toEqual(expected);
  });

  it('handles setConnectionMode() call', async () => {
    const spy = jest.spyOn(client, 'setConnectionMode');
    spy.mockResolvedValueOnce();

    await mockIpcMain.getHandler(getEventName('setConnectionMode'))?.({}, 'streaming');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenNthCalledWith(1, 'streaming');
  });

  it('handles getConnectionMode() call', () => {
    const spy = jest.spyOn(client, 'getConnectionMode');
    spy.mockReturnValueOnce('streaming');

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('getConnectionMode'))?.(event);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(event.returnValue).toEqual('streaming');
  });

  it('handles isOffline() call', () => {
    const spy = jest.spyOn(client, 'isOffline');
    spy.mockReturnValueOnce(true);

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('isOffline'))?.(event);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(event.returnValue).toEqual(true);
  });

  it('calls on() for addEventHandler call', () => {
    const spy = jest.spyOn(client, 'on');
    spy.mockReturnValueOnce();

    const event: MockIpcEvent = { ports: [mockPort] };
    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(event, {
      callbackId: 'callback1',
      eventName: 'event1',
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenNthCalledWith(1, 'event1', expect.any(Function));

    const callback = spy.mock.calls[0][1];
    callback(1, '2', true);

    expect(mockPort.postMessage).toHaveBeenCalledTimes(1);
    expect(mockPort.postMessage).toHaveBeenNthCalledWith(1, [1, '2', true]);
  });

  it('does not call on() when calling addEventHandler with an existing callbackId', () => {
    const spy = jest.spyOn(client, 'on');
    spy.mockReturnValueOnce();

    const event: MockIpcEvent = { ports: [mockPort] };
    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(event, {
      callbackId: 'callback1',
      eventName: 'event1',
    });

    expect(spy).not.toHaveBeenCalled();
  });

  it('does not call off() when calling removeEventHandler with an invalid eventName', () => {
    const spy = jest.spyOn(client, 'off');
    spy.mockReturnValueOnce();

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('removeEventHandler'))?.(event, 'event2', 'callback1');

    expect(spy).not.toHaveBeenCalled();
    expect(mockPort.close).not.toHaveBeenCalled();
    expect(event.returnValue).toEqual(false);
  });

  it('does not call off() when calling removeEventHandler with an invalid callbackId', () => {
    const spy = jest.spyOn(client, 'off');
    spy.mockReturnValueOnce();

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('removeEventHandler'))?.(event, 'event1', 'callback2');

    expect(spy).not.toHaveBeenCalled();
    expect(mockPort.close).not.toHaveBeenCalled();
    expect(event.returnValue).toEqual(false);
  });

  it('calls off() for removeEventHandler call', () => {
    const spy = jest.spyOn(client, 'off');
    spy.mockReturnValueOnce();

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('removeEventHandler'))?.(event, 'event1', 'callback1');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenNthCalledWith(1, 'event1', expect.any(Function));
    expect(mockPort.close).toHaveBeenCalledTimes(1);
    expect(event.returnValue).toEqual(true);
  });
});
