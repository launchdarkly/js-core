import { ipcMain } from 'electron';
import type { IpcMain } from 'electron';

import type {
  LDContext,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDIdentifyOptions,
  LDLogger,
} from '@launchdarkly/js-client-sdk-common';

import { ElectronClient } from '../src/ElectronClient';
import { getIPCChannelName } from '../src/ElectronIPC';
import ElectronCrypto from '../src/platform/ElectronCrypto';
import ElectronEncoding from '../src/platform/ElectronEncoding';
import ElectronInfo from '../src/platform/ElectronInfo';

type MockIpcMain = IpcMain & {
  getHandler: (eventName: string) => Function | undefined;
  removeAllListeners: (channel: string) => void;
  removeHandler: (channel: string) => void;
};
type MockPort = { postMessage: Function; close: Function };
type MockIpcEvent = { returnValue?: any; ports?: MockPort[] };

jest.mock('electron', () => {
  const handlers = new Map<string, Function>();
  return {
    ipcMain: {
      on: (eventName: string, handler: Function) => handlers.set(eventName, handler),
      handle: (eventName: string, handler: Function) => handlers.set(eventName, handler),
      getHandler: (eventName: string) => handlers.get(eventName),
      removeAllListeners: (channel: string) => handlers.delete(channel),
      removeHandler: (channel: string) => handlers.delete(channel),
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

const getEventName = (baseName: Parameters<typeof getIPCChannelName>[1]) =>
  getIPCChannelName(clientSideId, baseName);

const DEFAULT_INITIAL_CONTEXT = { kind: 'user' as const, key: 'test-user' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('given an initialized ElectronClient', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const client = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
    initialConnectionMode: 'offline',
    enableIPC: true,
    logger,
    diagnosticOptOut: true,
  });

  beforeAll(async () => {
    await client.start();
  });

  it('handles allFlags() call', () => {
    const spy = jest.spyOn(client, 'allFlags');
    spy.mockReturnValueOnce({ flag1: 'value1', flag2: true });

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('allFlags'))?.(event);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(event.returnValue).toEqual({ flag1: 'value1', flag2: true });
  });

  it('handles boolVariation() call', () => {
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

    const spy = jest.spyOn(client, 'identifyResult');
    spy.mockResolvedValueOnce({ status: 'completed' });

    const result = await mockIpcMain.getHandler(getEventName('identify'))?.({}, context, options);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenNthCalledWith(1, context, options);
    expect(result).toEqual({ status: 'completed' });
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

  it('does not call off() when calling removeEventHandler with an unknown callbackId', () => {
    const spy = jest.spyOn(client, 'off');

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('removeEventHandler'))?.(event, 'unknown-callback-id');

    expect(spy).not.toHaveBeenCalled();
    expect(mockPort.close).not.toHaveBeenCalled();
    expect(event.returnValue).toEqual(false);
  });

  it('does not grow state when removeEventHandler is called repeatedly for nonexistent callbackIds; later add with same id succeeds', () => {
    const onSpy = jest.spyOn(client, 'on');
    const portForAdd: MockPort = { postMessage: jest.fn(), close: jest.fn() };
    const eventName = 'change-reused-id';

    for (let i = 0; i < 10; i += 1) {
      const event: MockIpcEvent = {};
      mockIpcMain.getHandler(getEventName('removeEventHandler'))?.(event, 'reused-id');
      expect(event.returnValue).toEqual(false);
    }

    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(
      { ports: [portForAdd] } as MockIpcEvent,
      { callbackId: 'reused-id', eventName },
    );

    expect(onSpy).toHaveBeenCalledTimes(1);
    expect(portForAdd.close).not.toHaveBeenCalled();
  });

  it('calls off() for removeEventHandler call', () => {
    const eventWithPort: MockIpcEvent = { ports: [mockPort] };
    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(eventWithPort, {
      callbackId: 'callback1',
      eventName: 'event1',
    });

    const spy = jest.spyOn(client, 'off');
    spy.mockReturnValueOnce();

    const event: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('removeEventHandler'))?.(event, 'callback1');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenNthCalledWith(1, 'event1', expect.any(Function));
    expect(mockPort.close).toHaveBeenCalledTimes(1);
    expect(event.returnValue).toEqual(true);
  });

  it('registers when addEventHandler arrives after removeEventHandler for same callbackId (serialized: remove no-op then add succeeds)', () => {
    const onSpy = jest.spyOn(client, 'on');
    const portForRace: MockPort = { postMessage: jest.fn(), close: jest.fn() };
    const eventName = 'change-serialized-race';

    const removeEvent: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('removeEventHandler'))?.(removeEvent, 'race-callback-id');
    expect(removeEvent.returnValue).toEqual(false);

    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(
      { ports: [portForRace] } as MockIpcEvent,
      { callbackId: 'race-callback-id', eventName },
    );

    expect(onSpy).toHaveBeenCalledTimes(1);
    expect(onSpy).toHaveBeenNthCalledWith(1, eventName, expect.any(Function));
    expect(portForRace.close).not.toHaveBeenCalled();
  });

  it('broadcasts to all ports when multiple renderer subscribers listen to the same event', () => {
    const mockPort1: MockPort = { postMessage: jest.fn(), close: jest.fn() };
    const mockPort2: MockPort = { postMessage: jest.fn(), close: jest.fn() };
    const onSpy = jest.spyOn(client, 'on');

    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(
      { ports: [mockPort1] } as MockIpcEvent,
      { callbackId: 'sub1', eventName: 'change' },
    );
    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(
      { ports: [mockPort2] } as MockIpcEvent,
      { callbackId: 'sub2', eventName: 'change' },
    );

    expect(onSpy).toHaveBeenCalledTimes(1);
    const broadcastCallback = onSpy.mock.calls[0][1];
    broadcastCallback('arg1', 'arg2');

    expect(mockPort1.postMessage).toHaveBeenCalledTimes(1);
    expect(mockPort1.postMessage).toHaveBeenNthCalledWith(1, ['arg1', 'arg2']);
    expect(mockPort2.postMessage).toHaveBeenCalledTimes(1);
    expect(mockPort2.postMessage).toHaveBeenNthCalledWith(1, ['arg1', 'arg2']);
  });

  it('continues broadcasting to remaining ports when one port throws (e.g. closed MessagePort)', () => {
    const deadPort: MockPort = {
      postMessage: jest.fn().mockImplementation(() => {
        throw new Error('ERR_CLOSED_MESSAGE_PORT');
      }),
      close: jest.fn(),
    };
    const livePort: MockPort = { postMessage: jest.fn(), close: jest.fn() };
    const onSpy = jest.spyOn(client, 'on');
    const eventName = 'change-dead-port';

    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(
      { ports: [deadPort] } as MockIpcEvent,
      { callbackId: 'dead-sub', eventName },
    );
    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(
      { ports: [livePort] } as MockIpcEvent,
      { callbackId: 'live-sub', eventName },
    );

    const broadcastCallback = onSpy.mock.calls[0][1];
    broadcastCallback('arg1', 'arg2');

    expect(deadPort.postMessage).toHaveBeenCalledTimes(1);
    expect(livePort.postMessage).toHaveBeenCalledTimes(1);
    expect(livePort.postMessage).toHaveBeenNthCalledWith(1, ['arg1', 'arg2']);
    expect(logger.warn).toHaveBeenCalledWith(`Event ${eventName} broadcast failed`);

    broadcastCallback('arg3', 'arg4');
    expect(deadPort.postMessage).toHaveBeenCalledTimes(2);
    expect(livePort.postMessage).toHaveBeenCalledTimes(2);
    expect(livePort.postMessage).toHaveBeenNthCalledWith(2, ['arg3', 'arg4']);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });
});

describe('close()', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  it('removes all ipcMain listeners and handlers for the client so channels are no longer registered', async () => {
    const client = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      initialConnectionMode: 'offline',
      enableIPC: true,
      logger,
      diagnosticOptOut: true,
    });
    await client.start();

    expect(mockIpcMain.getHandler(getEventName('allFlags'))).toBeDefined();

    await client.close();

    expect(mockIpcMain.getHandler(getEventName('allFlags'))).toBeUndefined();
    expect(mockIpcMain.getHandler(getEventName('flush'))).toBeUndefined();
  });

  it('closes all event-handler MessagePorts when addEventHandler had been used', async () => {
    const client = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      initialConnectionMode: 'offline',
      enableIPC: true,
      logger,
      diagnosticOptOut: true,
    });
    await client.start();

    const event: MockIpcEvent = { ports: [mockPort] };
    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(event, {
      callbackId: 'callback1',
      eventName: 'change',
    });

    await client.close();

    expect(mockPort.close).toHaveBeenCalled();
  });

  it('is idempotent so calling close() twice does not throw', async () => {
    const client = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      initialConnectionMode: 'offline',
      enableIPC: true,
      logger,
      diagnosticOptOut: true,
    });
    await client.start();

    await client.close();
    await expect(client.close()).resolves.not.toThrow();
  });
});
