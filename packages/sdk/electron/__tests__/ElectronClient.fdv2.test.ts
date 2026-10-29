import type { ElectronOptions } from '../src/ElectronOptions';
import ElectronCrypto from '../src/platform/ElectronCrypto';
import ElectronEncoding from '../src/platform/ElectronEncoding';
import ElectronInfo from '../src/platform/ElectronInfo';
import { createMockLogger } from './testHelpers';

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

// The FDv1 data manager is automocked so a test can prove it is never constructed on the
// FDv2 path.
jest.mock('../src/ElectronDataManager');

// Tracks the mode last passed to the mock FDv2 data manager. Seeded from opts.foregroundMode
// when createFDv2DataManagerBase is called.
let mockCurrentMode = 'streaming';

// Captures the opts passed to createFDv2DataManagerBase so tests can call buildQueryParams
// and inspect the desktop defaults directly.
let capturedFDv2Opts:
  | {
      foregroundMode?: string;
      backgroundMode?: unknown;
      buildQueryParams: (opts?: { hash?: string }) => { key: string; value: string }[];
    }
  | undefined;

const mockSetConnectionMode = jest.fn((mode: string) => {
  mockCurrentMode = mode;
});
const mockSetNetworkState = jest.fn();

jest.mock('@launchdarkly/js-client-sdk-common', () => ({
  ...jest.requireActual('@launchdarkly/js-client-sdk-common'),
  createFDv2DataManagerBase: jest.fn((opts: any) => {
    capturedFDv2Opts = opts;
    mockCurrentMode = opts.foregroundMode ?? 'streaming';
    return {
      identify: jest.fn(),
      close: jest.fn(),
      setConnectionMode: mockSetConnectionMode,
      setNetworkState: mockSetNetworkState,
      getCurrentMode: () => mockCurrentMode,
    };
  }),
}));

import { createFDv2DataManagerBase, LDClientImpl } from '@launchdarkly/js-client-sdk-common';

import { createClient } from '../src';
import ElectronDataManager from '../src/ElectronDataManager';

const DEFAULT_INITIAL_CONTEXT = { kind: 'user' as const, key: 'bob' };
let logger: ReturnType<typeof createMockLogger>;

beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  capturedFDv2Opts = undefined;
  mockCurrentMode = 'streaming';
  logger = createMockLogger();
});

function makeFDv2Client(options: ElectronOptions = {}) {
  return createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    useClientSideId: true,
    enableIPC: false,
    dataSystem: {},
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
    ...options,
  });
}

// ------ Data manager selection ------

it('uses the FDv2 data manager when dataSystem is configured', () => {
  makeFDv2Client();

  expect(createFDv2DataManagerBase).toHaveBeenCalledTimes(1);
  expect(ElectronDataManager).not.toHaveBeenCalled();
});

it('keeps the FDv1 data manager when dataSystem is not configured', () => {
  createClient('client-side-id', DEFAULT_INITIAL_CONTEXT, {
    useClientSideId: true,
    enableIPC: false,
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
  });

  expect(ElectronDataManager).toHaveBeenCalledTimes(1);
  expect(createFDv2DataManagerBase).not.toHaveBeenCalled();
});

it('ignores useReport with a warning and still uses the FDv2 data manager when dataSystem is configured', () => {
  makeFDv2Client({ useReport: true });

  expect(createFDv2DataManagerBase).toHaveBeenCalledTimes(1);
  expect(ElectronDataManager).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('useReport'));
});

it('passes the desktop defaults so streaming is the FDv2 foreground mode and there is no background mode', () => {
  makeFDv2Client();

  expect(capturedFDv2Opts).toBeDefined();
  expect(capturedFDv2Opts!.foregroundMode).toBe('streaming');
  expect(capturedFDv2Opts!.backgroundMode).toBeUndefined();
});

// ------ FDv2 initial mode ------

it('reports offline at construction when FDv2 manual switching starts offline', () => {
  const client = makeFDv2Client({
    dataSystem: { automaticModeSwitching: { type: 'manual', initialConnectionMode: 'offline' } },
  });

  expect(client.isOffline()).toBe(true);
  expect(client.getConnectionMode()).toBe('offline');
});

it('reports polling at construction when FDv2 manual switching starts in polling', () => {
  const client = makeFDv2Client({
    dataSystem: { automaticModeSwitching: { type: 'manual', initialConnectionMode: 'polling' } },
  });

  expect(client.getConnectionMode()).toBe('polling');
  expect(client.isOffline()).toBe(false);
});

it('reports streaming at construction with the default FDv2 configuration', () => {
  const client = makeFDv2Client();

  expect(client.getConnectionMode()).toBe('streaming');
  expect(client.isOffline()).toBe(false);
});

// ------ buildQueryParams ------

it('buildQueryParams returns no parameters in FDv2 mobile key mode', () => {
  createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    dataSystem: {},
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
  });

  expect(capturedFDv2Opts).toBeDefined();
  expect(capturedFDv2Opts!.buildQueryParams()).toEqual([]);
});

it('buildQueryParams ignores a per-identify hash with a warning in FDv2 mobile key mode', () => {
  createClient('mobile-key-123', DEFAULT_INITIAL_CONTEXT, {
    enableIPC: false,
    dataSystem: {},
    diagnosticOptOut: true,
    sendEvents: false,
    logger,
  });

  expect(capturedFDv2Opts!.buildQueryParams({ hash: 'should-not-leak' })).toEqual([]);
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('hash'));
});

it('buildQueryParams returns the auth parameter in FDv2 client-side ID mode', () => {
  makeFDv2Client();

  expect(capturedFDv2Opts!.buildQueryParams()).toEqual([{ key: 'auth', value: 'client-side-id' }]);
});

it('buildQueryParams adds the h parameter when a hash is configured in client-side ID mode', () => {
  makeFDv2Client({ hash: 'secure-hash-abc' });

  expect(capturedFDv2Opts!.buildQueryParams()).toEqual([
    { key: 'auth', value: 'client-side-id' },
    { key: 'h', value: 'secure-hash-abc' },
  ]);
});

it('buildQueryParams uses the per-identify hash instead of the construction-time hash', () => {
  makeFDv2Client({ hash: 'construction-hash' });

  expect(capturedFDv2Opts!.buildQueryParams({ hash: 'per-identify-hash' })).toEqual([
    { key: 'auth', value: 'client-side-id' },
    { key: 'h', value: 'per-identify-hash' },
  ]);
});

it('buildQueryParams uses the construction-time hash when the per-identify hash is omitted', () => {
  makeFDv2Client({ hash: 'construction-hash' });

  expect(capturedFDv2Opts!.buildQueryParams({})).toEqual([
    { key: 'auth', value: 'client-side-id' },
    { key: 'h', value: 'construction-hash' },
  ]);
});

// ------ FDv2 setConnectionMode ------

it('setConnectionMode delegates to the FDv2 data manager', async () => {
  const client = makeFDv2Client();

  await client.setConnectionMode('offline');

  expect(mockSetConnectionMode).toHaveBeenCalledWith('offline');
  expect(client.getConnectionMode()).toBe('offline');
  expect(client.isOffline()).toBe(true);
});

it('isOffline returns false after switching back to streaming in FDv2 mode', async () => {
  const client = makeFDv2Client();

  await client.setConnectionMode('offline');
  await client.setConnectionMode('streaming');

  expect(client.getConnectionMode()).toBe('streaming');
  expect(client.isOffline()).toBe(false);
});

it('setConnectionMode forwards the current mode so the FDv2 data manager can dedupe', async () => {
  const client = makeFDv2Client();

  await client.setConnectionMode('streaming');

  expect(mockSetConnectionMode).toHaveBeenCalledWith('streaming');
  expect(client.getConnectionMode()).toBe('streaming');
});

it('reports the data manager mode when the network moves the data system offline in FDv2', () => {
  const client = makeFDv2Client();

  mockCurrentMode = 'offline';

  expect(client.getConnectionMode()).toBe('offline');
  expect(client.isOffline()).toBe(true);
});

it('falls back to the requested mode when the data manager reports an unsupported mode in FDv2', () => {
  const client = makeFDv2Client();

  mockCurrentMode = 'background';

  expect(client.getConnectionMode()).toBe('streaming');
  expect(client.isOffline()).toBe(false);
});

it('reports a requested mode at once while the data system has not applied it yet in FDv2', async () => {
  const client = makeFDv2Client();

  await client.setConnectionMode('offline');

  expect(mockCurrentMode).toBe('offline');
  mockCurrentMode = 'streaming';
  expect(client.getConnectionMode()).toBe('offline');
  expect(client.isOffline()).toBe(true);
});

it('keeps the requested mode when a later network change moves the data system in FDv2', async () => {
  const client = makeFDv2Client();
  await client.setConnectionMode('polling');

  mockCurrentMode = 'offline';

  expect(client.getConnectionMode()).toBe('polling');
  expect(client.isOffline()).toBe(false);
});

it('setConnectionMode forwards and reports the mode while the data system is offline in FDv2', async () => {
  const client = makeFDv2Client();
  await client.setConnectionMode('streaming');
  mockSetConnectionMode.mockClear();
  mockCurrentMode = 'offline';

  await client.setConnectionMode('streaming');

  expect(mockSetConnectionMode).toHaveBeenCalledWith('streaming');
  expect(client.getConnectionMode()).toBe('streaming');
});

it('concurrent setConnectionMode calls run in call order in FDv2', async () => {
  const client = makeFDv2Client();

  const p1 = client.setConnectionMode('offline');
  const p2 = client.setConnectionMode('streaming');
  await Promise.all([p1, p2]);

  expect(mockSetConnectionMode.mock.calls).toEqual([['offline'], ['streaming']]);
  expect(client.getConnectionMode()).toBe('streaming');
});

it('setConnectionMode after close is a no-op in FDv2', async () => {
  const client = makeFDv2Client();

  await client.close();
  await client.setConnectionMode('offline');

  expect(mockSetConnectionMode).not.toHaveBeenCalled();
});

it('setConnectionMode with an invalid mode warns and does not delegate in FDv2', async () => {
  const client = makeFDv2Client();

  // @ts-ignore JS callers can pass any string.
  await client.setConnectionMode('invalid-mode');

  expect(mockSetConnectionMode).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('invalid-mode'));
});

it('setConnectionMode rejects and keeps the mode when flush fails on the way offline in FDv2', async () => {
  const client = makeFDv2Client();
  const flushSpy = jest
    .spyOn(LDClientImpl.prototype, 'flush')
    .mockRejectedValueOnce(new Error('flush failed'));

  await expect(client.setConnectionMode('offline')).rejects.toThrow('flush failed');

  expect(client.getConnectionMode()).toBe('streaming');
  expect(mockSetConnectionMode).not.toHaveBeenCalled();
  flushSpy.mockRestore();
});

it('setConnectionMode queue stays usable after a failed offline transition in FDv2', async () => {
  const client = makeFDv2Client();
  const flushSpy = jest
    .spyOn(LDClientImpl.prototype, 'flush')
    .mockRejectedValueOnce(new Error('flush failed'));

  await expect(client.setConnectionMode('offline')).rejects.toThrow('flush failed');
  flushSpy.mockRestore();

  await client.setConnectionMode('polling');

  expect(client.getConnectionMode()).toBe('polling');
  expect(mockSetConnectionMode).toHaveBeenCalledWith('polling');
});

// ------ FDv2 network availability ------

it('forwards setNetworkAvailability to the FDv2 data manager when network switching is enabled', () => {
  const client = makeFDv2Client({
    dataSystem: {
      automaticModeSwitching: { type: 'automatic', lifecycle: false, network: true },
    },
  });

  client.setNetworkAvailability(false);
  client.setNetworkAvailability(true);

  expect(mockSetNetworkState.mock.calls).toEqual([['unavailable'], ['available']]);
});

it('forwards setNetworkAvailability when automaticModeSwitching is true', () => {
  const client = makeFDv2Client({ dataSystem: { automaticModeSwitching: true } });

  client.setNetworkAvailability(false);

  expect(mockSetNetworkState).toHaveBeenCalledWith('unavailable');
});

it('ignores setNetworkAvailability when automatic network switching is off, which is the desktop default', () => {
  const client = makeFDv2Client();

  client.setNetworkAvailability(false);

  expect(mockSetNetworkState).not.toHaveBeenCalled();
  expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('network switching'));
});

it('ignores setNetworkAvailability when granular switching leaves network off', () => {
  const client = makeFDv2Client({
    dataSystem: { automaticModeSwitching: { type: 'automatic', lifecycle: false } },
  });

  client.setNetworkAvailability(false);

  expect(mockSetNetworkState).not.toHaveBeenCalled();
});

it('ignores setNetworkAvailability when automatic mode switching is manual', () => {
  const client = makeFDv2Client({
    dataSystem: { automaticModeSwitching: { type: 'manual', initialConnectionMode: 'streaming' } },
  });

  client.setNetworkAvailability(false);

  expect(mockSetNetworkState).not.toHaveBeenCalled();
});
