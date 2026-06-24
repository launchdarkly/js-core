import { createClient as createBaseClient } from '@launchdarkly/js-client-sdk';

import { createClient } from '../../src/client/LDVueClient';

jest.mock('@launchdarkly/js-client-sdk', () => ({
  createClient: jest.fn(),
}));

const createBaseClientMock = createBaseClient as jest.Mock;

type Result = { status: string; error?: Error };

const makeBaseClient = (overrides: Record<string, unknown> = {}) => ({
  getContext: jest.fn(() => ({ kind: 'user', key: 'context-key' })),
  start: jest.fn(() => Promise.resolve<Result>({ status: 'complete' })),
  identify: jest.fn(() => Promise.resolve<Result>({ status: 'completed' })),
  boolVariation: jest.fn(() => true),
  on: jest.fn(),
  off: jest.fn(),
  close: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  createBaseClientMock.mockReset();
});

it('passes wrapper metadata to the base client', () => {
  createBaseClientMock.mockReturnValue(makeBaseClient());

  createClient('env-id', { kind: 'user', key: 'k' });

  expect(createBaseClientMock).toHaveBeenCalledWith(
    'env-id',
    { kind: 'user', key: 'k' },
    expect.objectContaining({ wrapperName: 'vue-client-sdk', wrapperVersion: expect.any(String) }),
  );
});

it('tracks initialization state through start()', async () => {
  createBaseClientMock.mockReturnValue(makeBaseClient());
  const client = createClient('env-id', { kind: 'user', key: 'k' });

  expect(client.getInitializationState()).toBe('initializing');
  expect(client.isReady()).toBe(false);

  await client.start();

  expect(client.getInitializationState()).toBe('complete');
  expect(client.isReady()).toBe(true);
  expect(client.getInitializationError()).toBeUndefined();
});

it('notifies init-status subscribers and replays the cached result to late subscribers', async () => {
  createBaseClientMock.mockReturnValue(makeBaseClient());
  const client = createClient('env-id', { kind: 'user', key: 'k' });

  const early = jest.fn();
  client.onInitializationStatusChange(early);

  await client.start();

  expect(early).toHaveBeenCalledWith({ status: 'complete' });

  const late = jest.fn();
  client.onInitializationStatusChange(late);
  expect(late).toHaveBeenCalledWith({ status: 'complete' });
});

it('exposes the initialization error when start fails', async () => {
  const error = new Error('boom');
  createBaseClientMock.mockReturnValue(
    makeBaseClient({ start: jest.fn(() => Promise.resolve({ status: 'failed', error })) }),
  );
  const client = createClient('env-id', { kind: 'user', key: 'k' });

  await client.start();

  expect(client.getInitializationState()).toBe('failed');
  expect(client.getInitializationError()).toBe(error);
});

it('notifies context subscribers after a successful identify', async () => {
  createBaseClientMock.mockReturnValue(makeBaseClient());
  const client = createClient('env-id', { kind: 'user', key: 'k' });

  const onContext = jest.fn();
  client.onContextChange(onContext);

  await client.identify({ kind: 'user', key: 'new-key' });

  expect(onContext).toHaveBeenCalledWith({ kind: 'user', key: 'context-key' });
});

it('does not notify context subscribers when identify does not complete', async () => {
  createBaseClientMock.mockReturnValue(
    makeBaseClient({ identify: jest.fn(() => Promise.resolve({ status: 'error', error: new Error('x') })) }),
  );
  const client = createClient('env-id', { kind: 'user', key: 'k' });

  const onContext = jest.fn();
  client.onContextChange(onContext);

  await client.identify({ kind: 'user', key: 'new-key' });

  expect(onContext).not.toHaveBeenCalled();
});
