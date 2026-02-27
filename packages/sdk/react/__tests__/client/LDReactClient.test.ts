import {
  createClient as createBaseClient,
  LDContextStrict,
  LDStartOptions,
} from '@launchdarkly/js-client-sdk';

import { createClient } from '../../src/client/LDReactClient';

// Simulate a browser environment so createClient returns the real client (not noop)
beforeAll(() => {
  // @ts-ignore
  global.window = {};
});

afterAll(() => {
  // @ts-ignore
  delete global.window;
});

// Build a minimal mock of the base LDClient returned by createBaseClient
function makeMockBaseClient(overrides: Record<string, any> = {}) {
  let resolveStart: (result: { status: 'complete' | 'failed' }) => void;
  const startPromise = new Promise<{ status: 'complete' | 'failed' }>((resolve) => {
    resolveStart = resolve;
  });

  let currentContext: LDContextStrict | undefined;
  let resolveIdentify: (result: { status: 'completed' }) => void;
  const identifyPromise = new Promise<{ status: 'completed' }>((resolve) => {
    resolveIdentify = resolve;
  });

  const mock = {
    start: jest.fn((_opts?: LDStartOptions) => startPromise),
    identify: jest.fn(() => identifyPromise),
    getContext: jest.fn(() => currentContext),
    allFlags: jest.fn(() => ({})),
    boolVariation: jest.fn(),
    boolVariationDetail: jest.fn(),
    close: jest.fn(() => Promise.resolve()),
    flush: jest.fn(() => Promise.resolve({ result: true })),
    jsonVariation: jest.fn(),
    jsonVariationDetail: jest.fn(),
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    numberVariation: jest.fn(),
    numberVariationDetail: jest.fn(),
    off: jest.fn(),
    on: jest.fn(),
    setStreaming: jest.fn(),
    stringVariation: jest.fn(),
    stringVariationDetail: jest.fn(),
    track: jest.fn(),
    variation: jest.fn(),
    variationDetail: jest.fn(),
    waitForInitialization: jest.fn(() => Promise.resolve({ status: 'complete' as const })),
    addHook: jest.fn(),
    ...overrides,
  };

  return {
    mock,
    resolveStart: (status: 'complete' | 'failed' = 'complete') => resolveStart({ status }),
    setContext: (ctx: LDContextStrict) => {
      currentContext = ctx;
    },
    resolveIdentify: () => resolveIdentify({ status: 'completed' }),
  };
}

jest.mock('@launchdarkly/js-client-sdk', () => {
  const original = jest.requireActual('@launchdarkly/js-client-sdk');
  return {
    ...original,
    createClient: jest.fn(),
  };
});

it('returns getInitializationState() === "unknown" initially', () => {
  const { mock } = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  expect(client.getInitializationState()).toBe('unknown');
});

it('returns "initializing" while start() is in-flight', async () => {
  const { mock, resolveStart } = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  const startPromise = client.start();
  expect(client.getInitializationState()).toBe('initializing');

  resolveStart('complete');
  await startPromise;
  expect(client.getInitializationState()).toBe('complete');
});

it('sets initializedState to "complete" after start() resolves', async () => {
  const { mock, resolveStart } = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  const startPromise = client.start();
  resolveStart('complete');
  await startPromise;

  expect(client.getInitializationState()).toBe('complete');
});

it('invokes onContextChange callback after identify() resolves with the new context', async () => {
  const newContext: LDContextStrict = { kind: 'user', key: 'user-2', name: 'Jamie' };
  const { mock, setContext, resolveIdentify } = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  const received: LDContextStrict[] = [];
  client.onContextChange((ctx) => received.push(ctx));

  const identifyPromise = client.identify(newContext);
  setContext(newContext);
  resolveIdentify();
  await identifyPromise;

  expect(received).toHaveLength(1);
  expect(received[0]).toEqual(newContext);
});

it('notifies multiple subscribers on identify()', async () => {
  const newContext: LDContextStrict = { kind: 'user', key: 'user-3' };
  const { mock, setContext, resolveIdentify } = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  const calls1: LDContextStrict[] = [];
  const calls2: LDContextStrict[] = [];
  client.onContextChange((ctx) => calls1.push(ctx));
  client.onContextChange((ctx) => calls2.push(ctx));

  const identifyPromise = client.identify(newContext);
  setContext(newContext);
  resolveIdentify();
  await identifyPromise;

  expect(calls1).toHaveLength(1);
  expect(calls2).toHaveLength(1);
});

it('stops notifying after the unsubscribe function is called', async () => {
  const newContext: LDContextStrict = { kind: 'user', key: 'user-4' };
  const { mock, setContext, resolveIdentify } = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  const received: LDContextStrict[] = [];
  const unsubscribe = client.onContextChange((ctx) => received.push(ctx));

  unsubscribe();

  const identifyPromise = client.identify(newContext);
  setContext(newContext);
  resolveIdentify();
  await identifyPromise;

  expect(received).toHaveLength(0);
});

it('does not invoke onContextChange when identify resolves with status error', async () => {
  const errorResult = { status: 'error' as const, error: new Error('test') };
  const { mock } = makeMockBaseClient();
  (mock.identify as jest.Mock).mockResolvedValueOnce(errorResult);
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  const received: LDContextStrict[] = [];
  client.onContextChange((ctx) => received.push(ctx));

  await client.identify({ kind: 'user', key: 'user-fail' });

  expect(received).toHaveLength(0);
});

it('noop client onContextChange returns a no-op unsubscribe', () => {
  // Force server-side behavior by temporarily removing window
  const originalWindow = global.window;
  // @ts-ignore
  delete global.window;

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  const unsubscribe = client.onContextChange(() => {});
  expect(typeof unsubscribe).toBe('function');
  // Should not throw
  expect(() => unsubscribe()).not.toThrow();

  // @ts-ignore
  global.window = originalWindow;
});
