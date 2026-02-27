import type { LDContext } from '@launchdarkly/node-client-sdk';

import { createClient } from '../src/index';
import { goodBootstrapData } from './testBootstrapData';
import { createMockLogger } from './testHelpers';

const DEFAULT_INITIAL_CONTEXT: LDContext = { kind: 'user', key: 'bob' };

it('returns an error result when identify() is called before start()', async () => {
  const client = createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    initialConnectionMode: 'offline',
  });
  const result = await client.identify({ kind: 'user', key: 'other' });
  expect(result.status).toBe('error');
  if (result.status === 'error') {
    expect(result.error.message).toBe('Identify called before start');
  }
});

it('can identify a new context after start() is called', async () => {
  const client = createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    initialConnectionMode: 'offline',
  });
  await client.start();
  await client.identify({ kind: 'user', key: 'new-context-key' });
  expect(client.getContext()).toEqual({ kind: 'user', key: 'new-context-key' });
  expect(client.variation('some-flag', 'default')).toBe('default');
});

it('identify() returns a completed result when called after start()', async () => {
  const client = createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    initialConnectionMode: 'offline',
  });
  await client.start();
  const result = await client.identify({ kind: 'user', key: 'new-key' });
  expect(result).toEqual({ status: 'completed' });
});

it('can start with an anonymous context as the initial context', async () => {
  const anonymousContext = { anonymous: true, kind: 'user' } as LDContext;
  const client = createClient('mobile-key-123', anonymousContext, {
    enableIPC: false,
    initialConnectionMode: 'offline',
  });
  await client.start();
  const ctx = client.getContext() as Record<string, unknown> | undefined;
  expect(ctx?.kind).toBe('user');
  expect(ctx?.anonymous).toBe(true);
  expect(client.variation('some-flag', 'default')).toBe('default');
});

it('can identify an anonymous context after start() is called', async () => {
  const client = createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    initialConnectionMode: 'offline',
  });
  await client.start();
  await client.identify({ anonymous: true, kind: 'user' } as LDContext);
  const ctx = client.getContext() as Record<string, unknown> | undefined;
  expect(ctx?.kind).toBe('user');
  expect(ctx?.anonymous).toBe(true);
});

it('start() returns the same promise when called twice', async () => {
  const client = createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    initialConnectionMode: 'offline',
  });
  const p1 = client.start();
  const p2 = client.start();
  expect(p1).toBe(p2);
  await p1;
});

it('evaluates flags from bootstrap data supplied to start()', async () => {
  const client = createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    initialConnectionMode: 'offline',
  });
  await client.start({ bootstrap: goodBootstrapData });

  expect(client.variation('killswitch', false)).toBe(true);
  expect(client.stringVariation('string-flag', '')).toBe('is bob');
  expect(client.boolVariation('cat', true)).toBe(false);
  expect(client.allFlags()).toMatchObject({
    killswitch: true,
    'string-flag': 'is bob',
    cat: false,
  });
});

it('reports the configured offline connection mode', () => {
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    initialConnectionMode: 'offline',
  });
  expect(client.getConnectionMode()).toBe('offline');
  expect(client.isOffline()).toBe(true);
});

it('reports not-offline when configured for streaming', () => {
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    initialConnectionMode: 'streaming',
    sendEvents: false,
    diagnosticOptOut: true,
  });
  expect(client.isOffline()).toBe(false);
});

it('setConnectionMode("offline") resolves and keeps the client offline', async () => {
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    initialConnectionMode: 'offline',
  });
  await expect(client.setConnectionMode('offline')).resolves.not.toThrow();
  expect(client.getConnectionMode()).toBe('offline');
});

it('warns when identify is called with a timeout above the high-timeout threshold', async () => {
  const logger = createMockLogger();
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    sendEvents: false,
    initialConnectionMode: 'offline',
    logger,
  });
  await client.start();
  await client.identify({ key: 'potato', kind: 'user' }, { timeout: 16 });
  expect(logger.warn).toHaveBeenCalledWith(
    'The identify function was called with a timeout greater than 15 seconds. We recommend a timeout of less than 15 seconds.',
  );
});

it('does not warn when the identify timeout equals the threshold', async () => {
  const logger = createMockLogger();
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    sendEvents: false,
    initialConnectionMode: 'offline',
    logger,
  });
  await client.start();
  await client.identify({ key: 'potato', kind: 'user' }, { timeout: 15 });
  expect(logger.warn).not.toHaveBeenCalled();
});
