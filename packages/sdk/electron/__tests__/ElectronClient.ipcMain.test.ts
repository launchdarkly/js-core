import { ipcMain } from 'electron';
import type { IpcMain } from 'electron';

import { LDClientImpl } from '@launchdarkly/js-client-sdk-common';
import type {
  LDContext,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDIdentifyOptions,
} from '@launchdarkly/js-client-sdk-common';

import { ElectronClient } from '../src/ElectronClient';
import { deriveNamespace, getIPCChannelName } from '../src/ElectronIPC';
import ElectronCrypto from '../src/platform/ElectronCrypto';
import ElectronEncoding from '../src/platform/ElectronEncoding';
import ElectronInfo from '../src/platform/ElectronInfo';
import ElectronPlatform from '../src/platform/ElectronPlatform';
import { createMockLogger } from './testHelpers';

type MockIpcMain = IpcMain & {
  getHandler: (eventName: string) => ((...args: any[]) => void) | undefined;
  getListeners: (eventName: string) => Array<(...args: any[]) => void>;
  removeAllListeners: (channel: string) => void;
  removeHandler: (channel: string) => void;
};
type MockPort = { postMessage: (...args: any[]) => void; close: (...args: any[]) => void };
type MockIpcEvent = { returnValue?: any; ports?: MockPort[] };

jest.mock('electron', () => {
  const listeners = new Map<string, Array<(...args: any[]) => void>>();
  const handlers = new Map<string, (...args: any[]) => void>();
  return {
    ipcMain: {
      on: (eventName: string, listener: (...args: any[]) => void) => {
        listeners.set(eventName, [...(listeners.get(eventName) ?? []), listener]);
      },
      handle: (eventName: string, handler: (...args: any[]) => void) => {
        // Electron throws on a second handler for one channel; the mock does the same.
        if (handlers.has(eventName)) {
          throw new Error(`Attempted to register a second handler for '${eventName}'`);
        }
        handlers.set(eventName, handler);
      },
      // The most recent registration, so a test reaches the listener it just added.
      getHandler: (eventName: string) => {
        const channelListeners = listeners.get(eventName) ?? [];
        return handlers.get(eventName) ?? channelListeners[channelListeners.length - 1];
      },
      getListeners: (eventName: string) => listeners.get(eventName) ?? [],
      removeListener: (channel: string, listener: (...args: any[]) => void) => {
        const remaining = (listeners.get(channel) ?? []).filter((l) => l !== listener);
        if (remaining.length > 0) {
          listeners.set(channel, remaining);
        } else {
          listeners.delete(channel);
        }
      },
      removeAllListeners: (channel: string) => listeners.delete(channel),
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

const getEventName = (baseName: Parameters<typeof getIPCChannelName>[1], namespace?: string) =>
  getIPCChannelName(deriveNamespace(clientSideId, namespace), baseName);

const DEFAULT_INITIAL_CONTEXT = { kind: 'user' as const, key: 'test-user' };

// A stream mock that delivers an empty put so a streaming identify completes.
const createMockEventSourceThatDeliversPut = (streamUri: string = '', options: any = {}) => ({
  streamUri,
  options,
  onclose: jest.fn(),
  addEventListener: jest.fn((eventName: string, callback: (e: { data?: string }) => void) => {
    if (eventName === 'put') {
      Promise.resolve().then(() => callback({ data: '{}' }));
    }
  }),
  close: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('given an initialized ElectronClient', () => {
  const logger = createMockLogger();

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

  it('handles log() by dispatching to the correct logger method', () => {
    mockIpcMain.getHandler(getEventName('log'))?.({}, 'warn', 'test warning');
    expect(logger.warn).toHaveBeenCalledWith('test warning');

    mockIpcMain.getHandler(getEventName('log'))?.({}, 'error', 'test error');
    expect(logger.error).toHaveBeenCalledWith('test error');

    mockIpcMain.getHandler(getEventName('log'))?.({}, 'info', 'test info');
    expect(logger.info).toHaveBeenCalledWith('test info');

    mockIpcMain.getHandler(getEventName('log'))?.({}, 'debug', 'test debug');
    expect(logger.debug).toHaveBeenCalledWith('test debug');
  });

  it('ignores log() calls with invalid severity levels', () => {
    mockIpcMain.getHandler(getEventName('log'))?.({}, 'invalid', 'should be ignored');
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
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

  it('keeps broadcasting to the remaining renderer after one renderer unsubscribes', () => {
    const portA: MockPort = { postMessage: jest.fn(), close: jest.fn() };
    const portB: MockPort = { postMessage: jest.fn(), close: jest.fn() };
    const onSpy = jest.spyOn(client, 'on');
    const offSpy = jest.spyOn(client, 'off');
    const eventName = 'change-two-renderers';

    mockIpcMain.getHandler(getEventName('addEventHandler'))?.({ ports: [portA] } as MockIpcEvent, {
      callbackId: 'renderer-a',
      eventName,
    });
    mockIpcMain.getHandler(getEventName('addEventHandler'))?.({ ports: [portB] } as MockIpcEvent, {
      callbackId: 'renderer-b',
      eventName,
    });

    const removeEvent: MockIpcEvent = {};
    mockIpcMain.getHandler(getEventName('removeEventHandler'))?.(removeEvent, 'renderer-a');

    expect(removeEvent.returnValue).toEqual(true);
    expect(portA.close).toHaveBeenCalledTimes(1);
    expect(offSpy).not.toHaveBeenCalled();

    const broadcastCallback = onSpy.mock.calls[0][1];
    broadcastCallback('payload');

    expect(portA.postMessage).not.toHaveBeenCalled();
    expect(portB.postMessage).toHaveBeenCalledTimes(1);
    expect(portB.postMessage).toHaveBeenNthCalledWith(1, ['payload']);
  });

  it('unsubscribes from the SDK event only after the last renderer leaves', () => {
    const portA: MockPort = { postMessage: jest.fn(), close: jest.fn() };
    const portB: MockPort = { postMessage: jest.fn(), close: jest.fn() };
    const offSpy = jest.spyOn(client, 'off');
    const eventName = 'change-last-renderer';

    mockIpcMain.getHandler(getEventName('addEventHandler'))?.({ ports: [portA] } as MockIpcEvent, {
      callbackId: 'last-a',
      eventName,
    });
    mockIpcMain.getHandler(getEventName('addEventHandler'))?.({ ports: [portB] } as MockIpcEvent, {
      callbackId: 'last-b',
      eventName,
    });

    mockIpcMain.getHandler(getEventName('removeEventHandler'))?.({}, 'last-a');
    expect(offSpy).not.toHaveBeenCalled();

    mockIpcMain.getHandler(getEventName('removeEventHandler'))?.({}, 'last-b');
    expect(offSpy).toHaveBeenCalledTimes(1);
    expect(offSpy).toHaveBeenNthCalledWith(1, eventName, expect.any(Function));
    expect(portB.close).toHaveBeenCalledTimes(1);
  });

  it('serves flag evaluations from the same client to every renderer window', () => {
    const spy = jest.spyOn(client, 'boolVariation').mockReturnValue(true);
    const eventFromWindowA: MockIpcEvent = {};
    const eventFromWindowB: MockIpcEvent = {};

    mockIpcMain.getHandler(getEventName('boolVariation'))?.(eventFromWindowA, 'flag1', false);
    mockIpcMain.getHandler(getEventName('boolVariation'))?.(eventFromWindowB, 'flag1', false);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(eventFromWindowA.returnValue).toEqual(true);
    expect(eventFromWindowB.returnValue).toEqual(true);
    spy.mockRestore();
  });

  it('keeps separate subscriptions for renderers listening to different events', () => {
    const portChange: MockPort = { postMessage: jest.fn(), close: jest.fn() };
    const portError: MockPort = { postMessage: jest.fn(), close: jest.fn() };
    const onSpy = jest.spyOn(client, 'on');

    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(
      { ports: [portChange] } as MockIpcEvent,
      { callbackId: 'diff-change', eventName: 'change-different-a' },
    );
    mockIpcMain.getHandler(getEventName('addEventHandler'))?.(
      { ports: [portError] } as MockIpcEvent,
      { callbackId: 'diff-error', eventName: 'change-different-b' },
    );

    expect(onSpy).toHaveBeenCalledTimes(2);
    const broadcastChange = onSpy.mock.calls[0][1];
    broadcastChange('only-change');

    expect(portChange.postMessage).toHaveBeenNthCalledWith(1, ['only-change']);
    expect(portError.postMessage).not.toHaveBeenCalled();
  });
});

describe('close()', () => {
  const logger = createMockLogger();

  it('removes all ipcMain listeners and handlers for the client so channels are no longer registered', async () => {
    const client = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      namespace: 'close-remove',
      initialConnectionMode: 'offline',
      enableIPC: true,
      logger,
      diagnosticOptOut: true,
    });
    await client.start();

    expect(mockIpcMain.getHandler(getEventName('allFlags', 'close-remove'))).toBeDefined();

    await client.close();

    expect(mockIpcMain.getHandler(getEventName('allFlags', 'close-remove'))).toBeUndefined();
    expect(mockIpcMain.getHandler(getEventName('flush', 'close-remove'))).toBeUndefined();
  });

  it('closes all event-handler MessagePorts when addEventHandler had been used', async () => {
    const client = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      namespace: 'close-ports',
      initialConnectionMode: 'offline',
      enableIPC: true,
      logger,
      diagnosticOptOut: true,
    });
    await client.start();

    const event: MockIpcEvent = { ports: [mockPort] };
    mockIpcMain.getHandler(getEventName('addEventHandler', 'close-ports'))?.(event, {
      callbackId: 'callback1',
      eventName: 'change',
    });

    await client.close();

    expect(mockPort.close).toHaveBeenCalled();
  });

  it('is idempotent so calling close() twice does not throw', async () => {
    const client = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      namespace: 'close-twice',
      initialConnectionMode: 'offline',
      enableIPC: true,
      logger,
      diagnosticOptOut: true,
    });
    await client.start();

    await client.close();
    await expect(client.close()).resolves.not.toThrow();
  });

  it('closes the ports of every renderer on close()', async () => {
    const client = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      initialConnectionMode: 'offline',
      enableIPC: true,
      logger,
      diagnosticOptOut: true,
      namespace: 'close-multi',
    });
    await client.start();
    const portA: MockPort = { postMessage: jest.fn(), close: jest.fn() };
    const portB: MockPort = { postMessage: jest.fn(), close: jest.fn() };

    mockIpcMain.getHandler(getEventName('addEventHandler', 'close-multi'))?.(
      { ports: [portA] } as MockIpcEvent,
      { callbackId: 'close-a', eventName: 'change' },
    );
    mockIpcMain.getHandler(getEventName('addEventHandler', 'close-multi'))?.(
      { ports: [portB] } as MockIpcEvent,
      { callbackId: 'close-b', eventName: 'dataSourceStatus' },
    );

    await client.close();

    expect(portA.close).toHaveBeenCalledTimes(1);
    expect(portB.close).toHaveBeenCalledTimes(1);
  });
});

describe('given a second client on an IPC namespace that is already in use', () => {
  const logger = createMockLogger();
  const options = {
    initialConnectionMode: 'offline' as const,
    enableIPC: true,
    logger,
    diagnosticOptOut: true,
  };

  it('mock ipcMain rejects a second handler for the same channel', () => {
    mockIpcMain.handle('ld:mock-dup:flush', () => undefined);

    expect(() => mockIpcMain.handle('ld:mock-dup:flush', () => undefined)).toThrow(
      "Attempted to register a second handler for 'ld:mock-dup:flush'",
    );
    mockIpcMain.removeHandler('ld:mock-dup:flush');
  });

  it('throws a clear error before registering any IPC channel', async () => {
    const owner = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      ...options,
      namespace: 'dup-owner',
    });
    const handleSpy = jest.spyOn(mockIpcMain, 'handle');
    const onSpy = jest.spyOn(mockIpcMain, 'on');

    expect(
      () =>
        new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
          ...options,
          namespace: 'dup-owner',
        }),
    ).toThrow(
      `IPC namespace "${deriveNamespace(clientSideId, 'dup-owner')}" is already in use by another LaunchDarkly client`,
    );

    expect(handleSpy).not.toHaveBeenCalled();
    expect(onSpy).not.toHaveBeenCalled();
    handleSpy.mockRestore();
    onSpy.mockRestore();
    await owner.close();
  });

  it('releases the namespace when channel registration throws', async () => {
    const foreignChannel = getEventName('flush', 'failed-open');
    mockIpcMain.handle(foreignChannel, () => undefined);

    expect(
      () =>
        new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
          ...options,
          namespace: 'failed-open',
        }),
    ).toThrow('Attempted to register a second handler');
    expect(mockIpcMain.getHandler(foreignChannel)).toBeDefined();
    mockIpcMain.removeHandler(foreignChannel);

    const retry = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      ...options,
      namespace: 'failed-open',
    });

    expect(mockIpcMain.getHandler(getEventName('allFlags', 'failed-open'))).toBeDefined();
    await retry.close();
  });

  it('keeps a foreign listener on a shared channel when a later registration fails', async () => {
    const foreignListener = jest.fn();
    const channel = getEventName('allFlags', 'failed-on');
    mockIpcMain.on(channel, foreignListener);
    const realOn = mockIpcMain.on.bind(mockIpcMain);
    const onSpy = jest.spyOn(mockIpcMain, 'on').mockImplementation(((
      eventName: string,
      listener: (...args: any[]) => void,
    ) => {
      if (eventName === getEventName('isOffline', 'failed-on')) {
        throw new Error('on failed');
      }
      return realOn(eventName, listener);
    }) as any);

    try {
      expect(
        () =>
          new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
            ...options,
            namespace: 'failed-on',
          }),
      ).toThrow('on failed');

      expect(mockIpcMain.getListeners(channel)).toEqual([foreignListener]);
      expect(mockIpcMain.getHandler(getEventName('flush', 'failed-on'))).toBeUndefined();
    } finally {
      onSpy.mockRestore();
      mockIpcMain.removeAllListeners(channel);
    }
  });

  it('registers every handle channel before any on channel', async () => {
    const order: string[] = [];
    const handleSpy = jest.spyOn(mockIpcMain, 'handle').mockImplementation((() => {
      order.push('handle');
    }) as any);
    const onSpy = jest.spyOn(mockIpcMain, 'on').mockImplementation((() => {
      order.push('on');
    }) as any);

    try {
      const client = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
        ...options,
        namespace: 'ordered',
      });
      handleSpy.mockRestore();
      onSpy.mockRestore();

      expect(order.lastIndexOf('handle')).toBeLessThan(order.indexOf('on'));
      await client.close();
    } finally {
      handleSpy.mockRestore();
      onSpy.mockRestore();
    }
  });

  it('keeps a foreign listener on a shared channel when the client closes', async () => {
    const foreignListener = jest.fn();
    const channel = getEventName('allFlags', 'close-foreign');
    mockIpcMain.on(channel, foreignListener);
    try {
      const client = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
        ...options,
        namespace: 'close-foreign',
      });

      await client.close();

      expect(mockIpcMain.getListeners(channel)).toEqual([foreignListener]);
    } finally {
      mockIpcMain.removeAllListeners(channel);
    }
  });

  it('stops the base client when the IPC channels fail to open', async () => {
    const foreignChannel = getEventName('flush', 'failed-stop');
    mockIpcMain.handle(foreignChannel, () => undefined);
    const baseCloseSpy = jest.spyOn(LDClientImpl.prototype, 'close');

    try {
      expect(
        () =>
          new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
            ...options,
            namespace: 'failed-stop',
          }),
      ).toThrow('Attempted to register a second handler');

      expect(baseCloseSpy).toHaveBeenCalledTimes(1);
    } finally {
      baseCloseSpy.mockRestore();
      mockIpcMain.removeHandler(foreignChannel);
    }
  });

  it('does not throw when the second client sets a different namespace option', async () => {
    const client = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      ...options,
      namespace: 'second-window',
    });

    expect(mockIpcMain.getHandler(getEventName('allFlags', 'second-window'))).toBeDefined();
    await client.close();
  });

  it('frees the namespace when the owning client closes', async () => {
    const first = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      ...options,
      namespace: 'reusable',
    });
    await first.close();

    const second = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      ...options,
      namespace: 'reusable',
    });

    expect(mockIpcMain.getHandler(getEventName('allFlags', 'reusable'))).toBeDefined();
    await second.close();
  });

  it('does not reserve a namespace when enableIPC is false', async () => {
    const first = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      ...options,
      enableIPC: false,
      namespace: 'no-ipc',
    });
    let second: ElectronClient | undefined;

    expect(() => {
      second = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
        ...options,
        enableIPC: false,
        namespace: 'no-ipc',
      });
    }).not.toThrow();
    await first.close();
    await second?.close();
  });
});

describe('given two renderers subscribed to dataSourceStatus before start()', () => {
  const logger = createMockLogger();
  // Plain arrays record the broadcasts because the file-level beforeEach clears every jest mock.
  const receivedByA: unknown[][] = [];
  const receivedByB: unknown[][] = [];
  const rendererPortA: MockPort = {
    postMessage: (message: unknown[]) => {
      receivedByA.push(message);
    },
    close: jest.fn(),
  };
  const rendererPortB: MockPort = {
    postMessage: (message: unknown[]) => {
      receivedByB.push(message);
    },
    close: jest.fn(),
  };
  let client: ElectronClient;

  beforeAll(async () => {
    (ElectronPlatform as jest.Mock).mockReturnValueOnce({
      crypto: new ElectronCrypto(),
      info: new ElectronInfo(),
      requests: {
        createEventSource: jest.fn((streamUri: string = '', options: any = {}) =>
          createMockEventSourceThatDeliversPut(streamUri, options),
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
    client = new ElectronClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
      initialConnectionMode: 'streaming',
      enableIPC: true,
      logger,
      diagnosticOptOut: true,
      sendEvents: false,
      namespace: 'status-window',
    });

    mockIpcMain.getHandler(getEventName('addEventHandler', 'status-window'))?.(
      { ports: [rendererPortA] } as MockIpcEvent,
      { callbackId: 'status-a', eventName: 'dataSourceStatus' },
    );
    mockIpcMain.getHandler(getEventName('addEventHandler', 'status-window'))?.(
      { ports: [rendererPortB] } as MockIpcEvent,
      { callbackId: 'status-b', eventName: 'dataSourceStatus' },
    );

    await client.start();
  });

  afterAll(async () => {
    await client.close();
  });

  const statesOf = (received: unknown[][]) =>
    received.map((message) => (message[0] as { state: string }).state);

  it('delivers the INITIALIZING and VALID statuses to the first renderer in order', () => {
    expect(statesOf(receivedByA)).toEqual(['INITIALIZING', 'VALID']);
  });

  it('delivers the same statuses to the second renderer', () => {
    expect(statesOf(receivedByB)).toEqual(['INITIALIZING', 'VALID']);
  });

  it('sends the full status object with stateSince to renderers', () => {
    const [lastMessage] = receivedByA.slice(-1);
    expect(lastMessage[0]).toEqual(
      expect.objectContaining({ state: 'VALID', stateSince: expect.any(Number) }),
    );
  });
});
