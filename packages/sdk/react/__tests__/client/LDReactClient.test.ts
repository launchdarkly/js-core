import {
  createClient as createBaseClient,
  LDContextStrict,
  LDStartOptions,
  LDWaitForInitializationResult,
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

it('returns getInitializationState() === "initializing" initially', () => {
  const { mock } = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  expect(client.getInitializationState()).toBe('initializing');
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

it('start() fires onContextChange subscribers with the new context', async () => {
  const ctx: LDContextStrict = { kind: 'user', key: 'u1' };
  const { mock, resolveStart, setContext } = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  const received: LDContextStrict[] = [];
  client.onContextChange((c) => received.push(c));

  const startPromise = client.start();
  setContext(ctx);
  resolveStart('complete');
  await startPromise;

  expect(received).toHaveLength(1);
  expect(received[0]).toEqual(ctx);
});

it('start() only notifies context subscribers once even if called multiple times', async () => {
  const ctx: LDContextStrict = { kind: 'user', key: 'u1' };
  const { mock, resolveStart, setContext } = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  const received: LDContextStrict[] = [];
  client.onContextChange((c) => received.push(c));

  setContext(ctx);
  const startPromise1 = client.start();
  resolveStart('complete');
  await startPromise1;

  // Second call should not notify again
  const startPromise2 = client.start();
  await startPromise2;

  expect(received).toHaveLength(1);
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

it('invokes onInitializationStatusChange callback after start() resolves', async () => {
  const { mock, resolveStart } = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  const received: LDWaitForInitializationResult[] = [];
  client.onInitializationStatusChange((result) => received.push(result));

  const startPromise = client.start();
  resolveStart('complete');
  await startPromise;

  expect(received).toHaveLength(1);
  expect(received[0].status).toBe('complete');
});

it('notifies multiple subscribers on start()', async () => {
  const { mock, resolveStart } = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  const calls1: LDWaitForInitializationResult[] = [];
  const calls2: LDWaitForInitializationResult[] = [];
  client.onInitializationStatusChange((r) => calls1.push(r));
  client.onInitializationStatusChange((r) => calls2.push(r));

  const startPromise = client.start();
  resolveStart('complete');
  await startPromise;

  expect(calls1).toHaveLength(1);
  expect(calls2).toHaveLength(1);
});

it('stops notifying after the unsubscribe function is called (onInitializationStatusChange)', async () => {
  const { mock, resolveStart } = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  const received: LDWaitForInitializationResult[] = [];
  const unsubscribe = client.onInitializationStatusChange((r) => received.push(r));

  unsubscribe();

  const startPromise = client.start();
  resolveStart('complete');
  await startPromise;

  expect(received).toHaveLength(0);
});

it('calls callback immediately if start() already resolved (late subscriber)', async () => {
  const { mock, resolveStart } = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  const startPromise = client.start();
  resolveStart('complete');
  await startPromise;

  const received: LDWaitForInitializationResult[] = [];
  client.onInitializationStatusChange((r) => received.push(r));

  expect(received).toHaveLength(1);
  expect(received[0].status).toBe('complete');
});

it('getInitializationError() returns undefined before start()', () => {
  const { mock } = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  expect(client.getInitializationError()).toBeUndefined();
});

it('getInitializationError() returns undefined after successful start()', async () => {
  const { mock, resolveStart } = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  const startPromise = client.start();
  resolveStart('complete');
  await startPromise;

  expect(client.getInitializationError()).toBeUndefined();
});

it('getInitializationError() returns the error after a failed start()', async () => {
  const { mock } = makeMockBaseClient();
  const failError = new Error('network failure');
  (mock.start as jest.Mock).mockResolvedValueOnce({ status: 'failed', error: failError });
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  await client.start();

  expect(client.getInitializationError()).toBe(failError);
});

it('noop client getInitializationError() returns an error', () => {
  const originalWindow = global.window;
  // @ts-ignore
  delete global.window;

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  expect(client.getInitializationError()).toEqual(
    new Error('Server-side client cannot be used to evaluate flags'),
  );

  // @ts-ignore
  global.window = originalWindow;
});

it('noop client onInitializationStatusChange returns a no-op unsubscribe', () => {
  const originalWindow = global.window;
  // @ts-ignore
  delete global.window;

  const client = createClient('test-id', { kind: 'user', key: 'u1' });
  const unsubscribe = client.onInitializationStatusChange(() => {});
  expect(typeof unsubscribe).toBe('function');
  expect(() => unsubscribe()).not.toThrow();

  // @ts-ignore
  global.window = originalWindow;
});

it('passes wrapperName to the base client', () => {
  const { mock } = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  createClient('test-id', { kind: 'user', key: 'u1' });

  expect(createBaseClient).toHaveBeenCalledWith(
    'test-id',
    { kind: 'user', key: 'u1' },
    expect.objectContaining({ wrapperName: 'react-client-sdk' }),
  );
});

it('preserves user-provided options alongside wrapper defaults', () => {
  const { mock } = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  createClient('test-id', { kind: 'user', key: 'u1' }, { streaming: false });

  expect(createBaseClient).toHaveBeenCalledWith(
    'test-id',
    { kind: 'user', key: 'u1' },
    expect.objectContaining({
      wrapperName: 'react-client-sdk',
      streaming: false,
    }),
  );
});

it('user-provided wrapperName/wrapperVersion overrides defaults', () => {
  const { mock } = makeMockBaseClient();
  (createBaseClient as jest.Mock).mockReturnValue(mock);

  createClient(
    'test-id',
    { kind: 'user', key: 'u1' },
    {
      wrapperName: 'custom',
      wrapperVersion: '9.9.9',
    },
  );

  expect(createBaseClient).toHaveBeenCalledWith(
    'test-id',
    { kind: 'user', key: 'u1' },
    expect.objectContaining({ wrapperName: 'custom', wrapperVersion: '9.9.9' }),
  );
});
