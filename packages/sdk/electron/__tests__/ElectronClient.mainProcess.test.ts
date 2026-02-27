import type { LDContext, LDIdentifyOptions, LDLogger } from '@launchdarkly/node-client-sdk';

import { createClient } from '../src/index';
import { goodBootstrapData } from './testBootstrapData';

const mockOn = jest.fn();
const mockHandle = jest.fn();

jest.mock('electron', () => ({
  ipcMain: {
    on: (eventName: string, handler: (...args: any[]) => void) => mockOn(eventName, handler),
    handle: (eventName: string, handler: (...args: any[]) => void) =>
      mockHandle(eventName, handler),
    removeAllListeners: jest.fn(),
    removeHandler: jest.fn(),
  },
  app: {
    getPath: () => '/tmp/ld-electron-test-userdata',
  },
}));

const clientSideId = 'client-side-id';
const DEFAULT_INITIAL_CONTEXT: LDContext = { kind: 'user', key: 'test-user' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('given a client created with enableIPC: false', () => {
  const logger: LDLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

  const client = createClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
    initialConnectionMode: 'offline',
    enableIPC: false,
    logger,
    sendEvents: false,
    diagnosticOptOut: true,
  });

  beforeAll(async () => {
    await client.start();
  });

  it('does not register any IPC channels', () => {
    expect(mockOn).not.toHaveBeenCalled();
    expect(mockHandle).not.toHaveBeenCalled();
  });

  it('evaluates variations and details directly on the client', () => {
    expect(client.allFlags()).toEqual({});
    expect(client.boolVariation('flag1', false)).toBe(false);
    expect(client.boolVariationDetail('flag1', false).value).toBe(false);
    expect(client.boolVariationDetail('flag1', false).reason).toBeDefined();
    expect(client.numberVariation('flag1', 0)).toBe(0);
    expect(client.stringVariation('flag1', '')).toBe('');
    expect(client.jsonVariation('flag1', {})).toEqual({});
    expect(client.variation('flag1', false)).toBe(false);
    expect(client.variationDetail('flag1', false).reason).toBeDefined();
  });

  it('returns the current context and supports identify', async () => {
    expect(client.getContext()).toEqual(DEFAULT_INITIAL_CONTEXT);
    const context: LDContext = { kind: 'user', key: 'test-user-id' };
    const options: LDIdentifyOptions = { waitForNetworkResults: true };
    const result = await client.identify(context, options);
    expect(result.status).toBe('completed');
    expect(client.getContext()).toEqual(context);
  });

  it('supports track, flush, and connection-mode queries without throwing', async () => {
    expect(() => client.track('event1', { key1: 'value1' }, 1234.5)).not.toThrow();
    const flushed = await client.flush();
    expect(flushed).toHaveProperty('result');
    expect(client.getConnectionMode()).toBe('offline');
    expect(client.isOffline()).toBe(true);
  });
});

it('evaluates flags from bootstrap when enableIPC is false', async () => {
  const client = createClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
    initialConnectionMode: 'offline',
    enableIPC: false,
    diagnosticOptOut: true,
  });
  await client.start({ bootstrap: goodBootstrapData });

  expect(client.variation('killswitch', false)).toBe(true);
  expect(client.stringVariation('string-flag', '')).toBe('is bob');
  expect(client.boolVariation('cat', true)).toBe(false);
});

it('does not register or remove channels on close when enableIPC is false', async () => {
  const client = createClient(clientSideId, DEFAULT_INITIAL_CONTEXT, {
    initialConnectionMode: 'offline',
    enableIPC: false,
    sendEvents: false,
    diagnosticOptOut: true,
  });
  await client.start();
  expect(mockOn).not.toHaveBeenCalled();
  expect(mockHandle).not.toHaveBeenCalled();
  await expect(client.close()).resolves.not.toThrow();
});
