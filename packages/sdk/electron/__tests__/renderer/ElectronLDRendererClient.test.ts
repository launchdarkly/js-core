import type {
  LDContext,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
} from '@launchdarkly/js-client-sdk-common';

import type { LDClientBridge } from '../../src/bridge/LDClientBridge';
import { ElectronLDRendererClient } from '../../src/renderer/ElectronLDRendererClient';

const ldClientBridge: LDClientBridge = {
  allFlags: jest.fn(),
  addEventHandler: jest.fn(),
  boolVariation: jest.fn(),
  boolVariationDetail: jest.fn(),
  flush: jest.fn(),
  getConnectionMode: jest.fn(),
  getContext: jest.fn(),
  identify: jest.fn(),
  isOffline: jest.fn(),
  jsonVariation: jest.fn(),
  jsonVariationDetail: jest.fn(),
  numberVariation: jest.fn(),
  numberVariationDetail: jest.fn(),
  removeEventHandler: jest.fn(),
  setConnectionMode: jest.fn(),
  stringVariation: jest.fn(),
  stringVariationDetail: jest.fn(),
  track: jest.fn(),
  variation: jest.fn(),
  variationDetail: jest.fn(),
};

globalThis.window = {
  // @ts-ignore
  ldClientBridge: jest.fn().mockReturnValue(ldClientBridge),
};

const clientSideId = 'client-side-id';

beforeEach(() => {
  jest.clearAllMocks();
});

it('initializes with client side id', () => {
  const client = new ElectronLDRendererClient(clientSideId);
  // @ts-ignore
  expect(globalThis.window.ldClientBridge).toHaveBeenCalledTimes(1);
  // @ts-ignore
  expect(globalThis.window.ldClientBridge).toHaveBeenNthCalledWith(1, clientSideId);
  expect(client).toBeDefined();
});

it('throws error if client bridge cannot be found', () => {
  // @ts-ignore
  (globalThis.window.ldClientBridge as jest.Mock).mockReturnValueOnce(undefined);

  expect(() => new ElectronLDRendererClient(clientSideId)).toThrow(
    'ElectronLDRendererClient must be used within an Electron renderer process with an available LDClientBridge',
  );
});

it('passes allFlags() call through to bridge', () => {
  (ldClientBridge.allFlags as jest.Mock).mockReturnValueOnce({ flag1: true });

  const client = new ElectronLDRendererClient(clientSideId);
  const result = client.allFlags();

  expect(ldClientBridge.allFlags).toHaveBeenCalledTimes(1);
  expect(result).toEqual({ flag1: true });
});

it('passes boolVariation() call through to bridge', () => {
  (ldClientBridge.boolVariation as jest.Mock).mockReturnValueOnce(true);

  const client = new ElectronLDRendererClient(clientSideId);
  const result = client.boolVariation('flag1', false);

  expect(ldClientBridge.boolVariation).toHaveBeenCalledTimes(1);
  expect(ldClientBridge.boolVariation).toHaveBeenNthCalledWith(1, 'flag1', false);
  expect(result).toEqual(true);
});

it('passes boolVariationDetail() call through to bridge', () => {
  const expected: LDEvaluationDetailTyped<boolean> = {
    value: true,
    reason: { kind: 'RULE_MATCH' },
  };

  (ldClientBridge.boolVariationDetail as jest.Mock).mockReturnValueOnce(expected);

  const client = new ElectronLDRendererClient(clientSideId);
  const result = client.boolVariationDetail('flag1', false);

  expect(ldClientBridge.boolVariationDetail).toHaveBeenCalledTimes(1);
  expect(ldClientBridge.boolVariationDetail).toHaveBeenNthCalledWith(1, 'flag1', false);
  expect(result).toEqual(expected);
});

it('passes flush() call through to bridge', async () => {
  (ldClientBridge.flush as jest.Mock).mockReturnValueOnce({ result: true });

  const client = new ElectronLDRendererClient(clientSideId);
  const result = await client.flush();

  expect(ldClientBridge.flush).toHaveBeenCalledTimes(1);
  expect(result).toEqual({ result: true });
});

it('passes getContext() call through to bridge', () => {
  const expected: LDContext = { kind: 'user', key: 'test-user-id' };

  (ldClientBridge.getContext as jest.Mock).mockReturnValueOnce(expected);

  const client = new ElectronLDRendererClient(clientSideId);
  const result = client.getContext();

  expect(ldClientBridge.getContext).toHaveBeenCalledTimes(1);
  expect(result).toEqual(expected);
});

it('passes identify() call through to bridge', async () => {
  const context: LDContext = { kind: 'user', key: 'test-user-id' };

  const client = new ElectronLDRendererClient(clientSideId);
  await client.identify(context, { waitForNetworkResults: true });

  expect(ldClientBridge.identify).toHaveBeenCalledTimes(1);
  expect(ldClientBridge.identify).toHaveBeenNthCalledWith(1, context, {
    waitForNetworkResults: true,
  });
});

it('passes jsonVariation() call through to bridge', () => {
  const expected = { key1: 'value1', key2: true };

  (ldClientBridge.jsonVariation as jest.Mock).mockReturnValueOnce(expected);

  const client = new ElectronLDRendererClient(clientSideId);
  const result = client.jsonVariation('flag1', {});

  expect(ldClientBridge.jsonVariation).toHaveBeenCalledTimes(1);
  expect(ldClientBridge.jsonVariation).toHaveBeenNthCalledWith(1, 'flag1', {});
  expect(result).toEqual(expected);
});

it('passes jsonVariationDetail() call through to bridge', () => {
  const expected: LDEvaluationDetailTyped<unknown> = {
    value: { key1: 'value1', key2: true },
    reason: { kind: 'RULE_MATCH' },
  };

  (ldClientBridge.jsonVariationDetail as jest.Mock).mockReturnValueOnce(expected);

  const client = new ElectronLDRendererClient(clientSideId);
  const result = client.jsonVariationDetail('flag1', {});

  expect(ldClientBridge.jsonVariationDetail).toHaveBeenCalledTimes(1);
  expect(ldClientBridge.jsonVariationDetail).toHaveBeenNthCalledWith(1, 'flag1', {});
  expect(result).toEqual(expected);
});

it('passes numberVariaion() call through to bridge', () => {
  (ldClientBridge.numberVariation as jest.Mock).mockReturnValueOnce(1234.5);

  const client = new ElectronLDRendererClient(clientSideId);
  const result = client.numberVariation('flag1', 0);

  expect(ldClientBridge.numberVariation).toHaveBeenCalledTimes(1);
  expect(ldClientBridge.numberVariation).toHaveBeenNthCalledWith(1, 'flag1', 0);
  expect(result).toEqual(1234.5);
});

it('passes numberVariaionDetail() call through to bridge', () => {
  const expected: LDEvaluationDetailTyped<number> = {
    value: 1234.5,
    reason: { kind: 'RULE_MATCH' },
  };

  (ldClientBridge.numberVariationDetail as jest.Mock).mockReturnValueOnce(expected);

  const client = new ElectronLDRendererClient(clientSideId);
  const result = client.numberVariationDetail('flag1', 0);

  expect(ldClientBridge.numberVariationDetail).toHaveBeenCalledTimes(1);
  expect(ldClientBridge.numberVariationDetail).toHaveBeenNthCalledWith(1, 'flag1', 0);
  expect(result).toEqual(expected);
});

it('passes stringVariaion() call through to bridge', () => {
  (ldClientBridge.stringVariation as jest.Mock).mockReturnValueOnce('value');

  const client = new ElectronLDRendererClient(clientSideId);
  const result = client.stringVariation('flag1', '');

  expect(ldClientBridge.stringVariation).toHaveBeenCalledTimes(1);
  expect(ldClientBridge.stringVariation).toHaveBeenNthCalledWith(1, 'flag1', '');
  expect(result).toEqual('value');
});

it('passes stringVariaionDetail() call through to bridge', () => {
  const expected: LDEvaluationDetailTyped<string> = {
    value: 'value',
    reason: { kind: 'RULE_MATCH' },
  };

  (ldClientBridge.stringVariationDetail as jest.Mock).mockReturnValueOnce(expected);

  const client = new ElectronLDRendererClient(clientSideId);
  const result = client.stringVariationDetail('flag1', '');

  expect(ldClientBridge.stringVariationDetail).toHaveBeenCalledTimes(1);
  expect(ldClientBridge.stringVariationDetail).toHaveBeenNthCalledWith(1, 'flag1', '');
  expect(result).toEqual(expected);
});

it('passes track() call through to bridge', () => {
  const client = new ElectronLDRendererClient(clientSideId);
  client.track('event1', { key1: 'value1' }, 1234.5);

  expect(ldClientBridge.track).toHaveBeenCalledTimes(1);
  expect(ldClientBridge.track).toHaveBeenNthCalledWith(1, 'event1', { key1: 'value1' }, 1234.5);
});

it('passes variation() call through to bridge', () => {
  (ldClientBridge.variation as jest.Mock).mockReturnValueOnce(true);

  const client = new ElectronLDRendererClient(clientSideId);
  const result = client.variation('flag1', false);

  expect(ldClientBridge.variation).toHaveBeenCalledTimes(1);
  expect(ldClientBridge.variation).toHaveBeenNthCalledWith(1, 'flag1', false);
  expect(result).toEqual(true);
});

it('passes variationDetail() call through to bridge', () => {
  const expected: LDEvaluationDetail = {
    value: true,
    reason: { kind: 'RULE_MATCH' },
  };

  (ldClientBridge.variationDetail as jest.Mock).mockReturnValueOnce(expected);

  const client = new ElectronLDRendererClient(clientSideId);
  const result = client.variationDetail('flag1', false);

  expect(ldClientBridge.variationDetail).toHaveBeenCalledTimes(1);
  expect(ldClientBridge.variationDetail).toHaveBeenNthCalledWith(1, 'flag1', false);
  expect(result).toEqual(expected);
});

it('passes setConnectionMode() call through to bridge', async () => {
  const client = new ElectronLDRendererClient(clientSideId);
  await client.setConnectionMode('streaming');

  expect(ldClientBridge.setConnectionMode).toHaveBeenCalledTimes(1);
  expect(ldClientBridge.setConnectionMode).toHaveBeenNthCalledWith(1, 'streaming');
});

it('passes getConnectionMode() call through to bridge', () => {
  (ldClientBridge.getConnectionMode as jest.Mock).mockReturnValueOnce('streaming');

  const client = new ElectronLDRendererClient(clientSideId);
  const result = client.getConnectionMode();

  expect(ldClientBridge.getConnectionMode).toHaveBeenCalledTimes(1);
  expect(result).toEqual('streaming');
});

it('passes isOffline() call through to bridge', () => {
  (ldClientBridge.isOffline as jest.Mock).mockReturnValueOnce(true);

  const client = new ElectronLDRendererClient(clientSideId);
  const result = client.isOffline();

  expect(ldClientBridge.isOffline).toHaveBeenCalledTimes(1);
  expect(result).toEqual(true);
});

describe('given an instance of ElectronLDRendererClient', () => {
  const client = new ElectronLDRendererClient(clientSideId);

  // eslint-disable-next-line no-console
  const callback = () => console.log('callback');

  it('can register an event callback with on()', () => {
    (ldClientBridge.addEventHandler as jest.Mock).mockReturnValueOnce('callback-1-id');

    client.on('event-1', callback);

    expect(ldClientBridge.addEventHandler).toHaveBeenCalledTimes(1);
    expect(ldClientBridge.addEventHandler).toHaveBeenNthCalledWith(1, 'event-1', callback);
  });

  it('can register an event callback twice to the same event with on()', () => {
    (ldClientBridge.addEventHandler as jest.Mock).mockReturnValueOnce('callback-2-id');

    client.on('event-1', callback);

    expect(ldClientBridge.addEventHandler).toHaveBeenCalledTimes(1);
    expect(ldClientBridge.addEventHandler).toHaveBeenNthCalledWith(1, 'event-1', callback);
  });

  it('can register an event callback to a different event with on()', () => {
    (ldClientBridge.addEventHandler as jest.Mock).mockReturnValueOnce('callback-3-id');

    client.on('event-2', callback);

    expect(ldClientBridge.addEventHandler).toHaveBeenCalledTimes(1);
    expect(ldClientBridge.addEventHandler).toHaveBeenNthCalledWith(1, 'event-2', callback);
  });

  it('will not complete off() if bridge reports that the handler could not be removed', () => {
    (ldClientBridge.removeEventHandler as jest.Mock).mockReturnValueOnce(false);

    client.off('event-1', callback);

    expect(ldClientBridge.removeEventHandler).toHaveBeenCalledTimes(1);
    expect(ldClientBridge.removeEventHandler).toHaveBeenNthCalledWith(
      1,
      'event-1',
      'callback-2-id',
    );
  });

  it('will unregister callback from event with off() in reverse registration order per event', () => {
    (ldClientBridge.removeEventHandler as jest.Mock).mockReturnValueOnce(true);
    (ldClientBridge.removeEventHandler as jest.Mock).mockReturnValueOnce(true);
    (ldClientBridge.removeEventHandler as jest.Mock).mockReturnValueOnce(true);

    client.off('event-1', callback);
    client.off('event-1', callback);
    client.off('event-2', callback);

    expect(ldClientBridge.removeEventHandler).toHaveBeenCalledTimes(3);
    expect(ldClientBridge.removeEventHandler).toHaveBeenNthCalledWith(
      1,
      'event-1',
      'callback-2-id',
    );
    expect(ldClientBridge.removeEventHandler).toHaveBeenNthCalledWith(
      2,
      'event-1',
      'callback-1-id',
    );
    expect(ldClientBridge.removeEventHandler).toHaveBeenNthCalledWith(
      3,
      'event-2',
      'callback-3-id',
    );
  });

  it('unregistering with off() does nothing if callback is not registered', () => {
    client.off('event-1', callback);

    expect(ldClientBridge.removeEventHandler).not.toHaveBeenCalled();
  });
});
