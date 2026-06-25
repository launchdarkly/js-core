import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import NodeCrypto from '../src/platform/NodeCrypto';
import NodeEncoding from '../src/platform/NodeEncoding';
import NodeInfo from '../src/platform/NodeInfo';
import { resetNodeStorage } from '../src/platform/NodeStorage';
import { createMockLogger } from './testHelpers';

jest.mock('../src/platform/NodePlatform', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    crypto: new NodeCrypto(),
    info: new NodeInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new NodeEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  })),
}));

// Tracks the mode last passed to the mock FDv2 data manager's setConnectionMode.
// Seeded from opts.foregroundMode when createFDv2DataManagerBase is called.
// Used only to verify delegation; NodeClient now tracks requested mode itself.
let mockCurrentMode = 'streaming';

// Captures the opts passed to createFDv2DataManagerBase so tests can invoke
// buildQueryParams directly.
let capturedFDv2Opts:
  | { buildQueryParams: (opts?: { hash?: string }) => { key: string; value: string }[] }
  | undefined;

const mockSetConnectionMode = jest.fn((mode: string) => {
  mockCurrentMode = mode;
});

jest.mock('@launchdarkly/js-client-sdk-common', () => ({
  ...jest.requireActual('@launchdarkly/js-client-sdk-common'),
  createFDv2DataManagerBase: jest.fn((opts: any) => {
    capturedFDv2Opts = opts;
    mockCurrentMode = opts.foregroundMode ?? 'streaming';
    return {
      identify: jest.fn(),
      close: jest.fn(),
      setConnectionMode: mockSetConnectionMode,
      getCurrentMode: () => mockCurrentMode,
    };
  }),
}));

import { createClient } from '../src';

const DEFAULT_INITIAL_CONTEXT = { kind: 'user' as const, key: 'bob' };
let tmpRoot: string;
let logger: ReturnType<typeof createMockLogger>;

beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(async () => {
  jest.clearAllMocks();
  capturedFDv2Opts = undefined;
  mockCurrentMode = 'streaming';
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'node-client-fdv2-test-'));
  resetNodeStorage();
  logger = createMockLogger();
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

it('setConnectionMode does not throw in FDv2 mode', async () => {
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    dataSystem: {},
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
    localStoragePath: tmpRoot,
  });
  await expect(client.setConnectionMode('offline')).resolves.toBeUndefined();
});

it('getConnectionMode returns the mode set via setConnectionMode in FDv2 mode', async () => {
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    dataSystem: {},
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
    localStoragePath: tmpRoot,
  });
  await client.setConnectionMode('offline');
  expect(client.getConnectionMode()).toBe('offline');
  expect(client.isOffline()).toBe(true);
});

it('isOffline returns false after switching back to streaming in FDv2 mode', async () => {
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    dataSystem: {},
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
    localStoragePath: tmpRoot,
  });
  await client.setConnectionMode('offline');
  await client.setConnectionMode('streaming');
  expect(client.getConnectionMode()).toBe('streaming');
  expect(client.isOffline()).toBe(false);
});

it('setConnectionMode delegates to the FDv2 data manager', async () => {
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    dataSystem: {},
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
    localStoragePath: tmpRoot,
  });
  await client.setConnectionMode('offline');
  expect(mockSetConnectionMode).toHaveBeenCalledWith('offline');
});

// ------ FDv2 initial mode reconciliation ------

it('isOffline returns true initially when FDv2 dataSystem configures offline mode', () => {
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    dataSystem: { automaticModeSwitching: { type: 'manual', initialConnectionMode: 'offline' } },
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
    localStoragePath: tmpRoot,
  });
  expect(client.isOffline()).toBe(true);
  expect(client.getConnectionMode()).toBe('offline');
});

it('getConnectionMode reflects FDv2 manual polling mode at construction', () => {
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    dataSystem: { automaticModeSwitching: { type: 'manual', initialConnectionMode: 'polling' } },
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
    localStoragePath: tmpRoot,
  });
  expect(client.getConnectionMode()).toBe('polling');
  expect(client.isOffline()).toBe(false);
});

// ------ buildQueryParams coverage ------

it('buildQueryParams returns [] in FDv2 mobile key mode', () => {
  createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    useMobileKey: true,
    dataSystem: {},
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
    localStoragePath: tmpRoot,
  });
  expect(capturedFDv2Opts).toBeDefined();
  expect(capturedFDv2Opts!.buildQueryParams()).toEqual([]);
});

it('buildQueryParams ignores and warns when per-identify hash is set in FDv2 mobile key mode', () => {
  createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    useMobileKey: true,
    dataSystem: {},
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
    localStoragePath: tmpRoot,
  });
  expect(capturedFDv2Opts).toBeDefined();
  expect(capturedFDv2Opts!.buildQueryParams({ hash: 'should-not-leak' })).toEqual([]);
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('hash'));
});

it('buildQueryParams returns auth param in FDv2 client-side ID mode', () => {
  createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    dataSystem: {},
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
    localStoragePath: tmpRoot,
  });
  expect(capturedFDv2Opts).toBeDefined();
  expect(capturedFDv2Opts!.buildQueryParams()).toEqual([{ key: 'auth', value: 'client-side-id' }]);
});

it('buildQueryParams includes hash param when hash is set in client-side ID mode', () => {
  createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    dataSystem: {},
    hash: 'secure-hash-abc',
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
    localStoragePath: tmpRoot,
  });
  expect(capturedFDv2Opts).toBeDefined();
  expect(capturedFDv2Opts!.buildQueryParams()).toEqual([
    { key: 'auth', value: 'client-side-id' },
    { key: 'h', value: 'secure-hash-abc' },
  ]);
});

it('buildQueryParams per-identify hash overrides construction-time hash in FDv2', () => {
  createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    dataSystem: {},
    hash: 'construction-hash',
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
    localStoragePath: tmpRoot,
  });
  expect(capturedFDv2Opts).toBeDefined();
  expect(capturedFDv2Opts!.buildQueryParams({ hash: 'per-identify-hash' })).toEqual([
    { key: 'auth', value: 'client-side-id' },
    { key: 'h', value: 'per-identify-hash' },
  ]);
});

it('buildQueryParams uses construction-time hash when no per-identify hash is provided in FDv2', () => {
  createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    dataSystem: {},
    hash: 'construction-hash',
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
    localStoragePath: tmpRoot,
  });
  expect(capturedFDv2Opts).toBeDefined();
  expect(capturedFDv2Opts!.buildQueryParams({})).toEqual([
    { key: 'auth', value: 'client-side-id' },
    { key: 'h', value: 'construction-hash' },
  ]);
});

// ------ Concurrent setConnectionMode serialization ------

it('concurrent setConnectionMode calls are serialized in call order', async () => {
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    dataSystem: {},
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
    localStoragePath: tmpRoot,
  });
  // Fire offline then streaming concurrently. Without serialization the offline
  // branch's await flush() lets streaming complete first, reversing the order.
  const p1 = client.setConnectionMode('offline');
  const p2 = client.setConnectionMode('streaming');
  await Promise.all([p1, p2]);
  // Serialization ensures the calls execute in issue order: offline then streaming.
  expect(mockSetConnectionMode.mock.calls).toEqual([['offline'], ['streaming']]);
  expect(client.getConnectionMode()).toBe('streaming');
  expect(client.isOffline()).toBe(false);
});

// ------ Idempotency ------

it('setConnectionMode is a no-op when called with the current mode in FDv2', async () => {
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    dataSystem: {},
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
    localStoragePath: tmpRoot,
  });
  // Initial mode is streaming; calling streaming again should be a no-op.
  await client.setConnectionMode('streaming');
  expect(mockSetConnectionMode).not.toHaveBeenCalled();
  expect(client.getConnectionMode()).toBe('streaming');
});

// ------ Post-close guard ------

it('setConnectionMode after close is a no-op in FDv2', async () => {
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    dataSystem: {},
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
    localStoragePath: tmpRoot,
  });
  await client.close();
  await client.setConnectionMode('offline');
  expect(mockSetConnectionMode).not.toHaveBeenCalled();
});

// ------ Invalid mode validation ------

it('setConnectionMode with an invalid mode logs a warning and does not delegate in FDv2', async () => {
  const client = createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    dataSystem: {},
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
    localStoragePath: tmpRoot,
  });
  // @ts-ignore testing JS callers passing an invalid value
  await client.setConnectionMode('invalid-mode');
  expect(mockSetConnectionMode).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('invalid-mode'));
});
