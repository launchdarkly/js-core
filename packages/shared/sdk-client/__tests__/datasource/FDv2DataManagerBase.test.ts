import { Context, ServiceEndpoints } from '@launchdarkly/js-sdk-common';

import { MODE_TABLE } from '../../src/datasource/ConnectionModeConfig';
import { createFDv1PollingSynchronizer } from '../../src/datasource/fdv2/FDv1PollingSynchronizer';
import { createFDv2DataSource } from '../../src/datasource/fdv2/FDv2DataSource';
import { makeFDv2Requestor } from '../../src/datasource/fdv2/FDv2Requestor';
import { createSynchronizerSlot } from '../../src/datasource/fdv2/SourceManager';
import {
  createFDv2DataManagerBase,
  FDv2DataManagerBaseConfig,
  FDv2DataManagerControl,
} from '../../src/datasource/FDv2DataManagerBase';
import { BROWSER_TRANSITION_TABLE } from '../../src/datasource/ModeResolver';
import { makeRequestor } from '../../src/datasource/Requestor';
import {
  createStateDebounceManager,
  PendingState,
} from '../../src/datasource/StateDebounceManager';
import { namespaceForEnvironment } from '../../src/storage/namespaceUtils';

jest.mock('../../src/datasource/fdv2/FDv2DataSource');
jest.mock('../../src/datasource/StateDebounceManager');
jest.mock('../../src/storage/namespaceUtils');
jest.mock('../../src/datasource/fdv2/FDv2Requestor');
jest.mock('../../src/datasource/Requestor');
jest.mock('../../src/datasource/fdv2/FDv1PollingSynchronizer');

const mockCreateFDv2DataSource = createFDv2DataSource as jest.MockedFunction<
  typeof createFDv2DataSource
>;
const mockCreateStateDebounceManager = createStateDebounceManager as jest.MockedFunction<
  typeof createStateDebounceManager
>;
const mockNamespaceForEnvironment = namespaceForEnvironment as jest.MockedFunction<
  typeof namespaceForEnvironment
>;
const mockMakeFDv2Requestor = makeFDv2Requestor as jest.MockedFunction<typeof makeFDv2Requestor>;

function makeLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

function makePlatform() {
  return {
    requests: {
      fetch: jest.fn(),
      createEventSource: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: {
      btoa: jest.fn((s: string) => Buffer.from(s).toString('base64')),
    },
    crypto: {
      createHash: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        asyncDigest: jest.fn().mockResolvedValue('hashed'),
      })),
      randomUUID: jest.fn(() => 'test-uuid'),
    },
    storage: undefined,
  } as any;
}

function makeConfig(overrides: Partial<any> = {}) {
  return {
    logger: makeLogger(),
    serviceEndpoints: new ServiceEndpoints('https://stream', 'https://poll', 'https://events'),
    withReasons: false,
    useReport: false,
    streamInitialReconnectDelay: 1,
    pollInterval: 300,
    dataSystem: undefined,
    ...overrides,
  } as any;
}

function makeFlagManager() {
  return {
    init: jest.fn(),
    upsert: jest.fn(),
    applyChanges: jest.fn().mockResolvedValue(undefined),
    setBootstrap: jest.fn(),
    get: jest.fn(),
    getAll: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  } as any;
}

function makeSourceFactoryProvider() {
  return {
    createInitializerFactory: jest.fn((entry: any) =>
      entry?.type === 'cache' ? { create: jest.fn(), isCache: true } : { create: jest.fn() },
    ),
    createSynchronizerSlot: jest.fn((_entry: any) => createSynchronizerSlot({ create: jest.fn() })),
  };
}

interface MockDataSource {
  start: jest.Mock;
  close: jest.Mock;
  resolveStart: () => void;
  rejectStart: (err: Error) => void;
}

// Make a data source mock with a start() promise that the test can settle.
// Like the real data source, close() rejects a start() that is not settled.
// When autoResolve is true, start() resolves immediately.
function makeMockDataSource(autoResolve: boolean): MockDataSource {
  let resolveStart!: () => void;
  let rejectStart!: (err: Error) => void;
  const startPromise = new Promise<void>((res, rej) => {
    resolveStart = res;
    rejectStart = rej;
  });
  return {
    start: jest.fn(() => {
      if (autoResolve) {
        resolveStart();
      }
      return startPromise;
    }),
    close: jest.fn(() =>
      rejectStart(new Error('Data source closed before initialization completed.')),
    ),
    resolveStart,
    rejectStart,
  };
}

// Captured config and callbacks from mocks.
let capturedDataSourceConfigs: any[];
let capturedOnReconcile: ((pendingState: PendingState) => void) | undefined;
// The data sources that createFDv2DataSource made, in creation order.
let createdDataSources: MockDataSource[];
// Set to false before the data source is made to settle start() in the test.
let autoResolveStart: boolean;
let mockDebounceManager: {
  setNetworkState: jest.Mock;
  setLifecycleState: jest.Mock;
  setRequestedMode: jest.Mock;
  close: jest.Mock;
};

function makeBaseConfig(
  overrides: Partial<FDv2DataManagerBaseConfig> = {},
): FDv2DataManagerBaseConfig {
  return {
    platform: makePlatform(),
    flagManager: makeFlagManager(),
    credential: 'test-credential',
    config: makeConfig(),
    baseHeaders: { authorization: 'test-credential' },
    emitter: { emit: jest.fn(), on: jest.fn(), off: jest.fn() } as any,
    transitionTable: BROWSER_TRANSITION_TABLE,
    foregroundMode: 'one-shot',
    backgroundMode: undefined,
    modeTable: MODE_TABLE,
    sourceFactoryProvider: makeSourceFactoryProvider(),
    buildQueryParams: jest.fn(() => []),
    ...overrides,
  };
}

function makeContext() {
  return Context.fromLDContext({ kind: 'user', key: 'test-key' });
}

beforeEach(() => {
  jest.clearAllMocks();

  capturedDataSourceConfigs = [];
  capturedOnReconcile = undefined;

  createdDataSources = [];
  autoResolveStart = true;

  mockCreateFDv2DataSource.mockImplementation((cfg: any) => {
    capturedDataSourceConfigs.push(cfg);
    const source = makeMockDataSource(autoResolveStart);
    createdDataSources.push(source);
    return source as any;
  });

  mockDebounceManager = {
    setNetworkState: jest.fn(),
    setLifecycleState: jest.fn(),
    setRequestedMode: jest.fn(),
    close: jest.fn(),
  };

  mockCreateStateDebounceManager.mockImplementation((cfg: any) => {
    capturedOnReconcile = cfg.onReconcile;
    return mockDebounceManager;
  });

  mockNamespaceForEnvironment.mockResolvedValue('test-namespace');
  mockMakeFDv2Requestor.mockReturnValue({} as any);
});

async function identifyManager(
  manager: FDv2DataManagerControl,
  identifyOptions?: any,
): Promise<{ resolve: jest.Mock; reject: jest.Mock }> {
  const resolve = jest.fn();
  const reject = jest.fn();
  await manager.identify(resolve, reject, makeContext(), identifyOptions);
  // Flush microtasks so the start() promise resolves.
  await Promise.resolve();
  await Promise.resolve();
  return { resolve, reject };
}

async function flushPromises() {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

it('creates a data source for the resolved mode on identify', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig());
  await identifyManager(manager);

  expect(mockCreateFDv2DataSource).toHaveBeenCalledTimes(1);
  expect(createdDataSources[0].start).toHaveBeenCalledTimes(1);

  manager.close();
});

it('tears down the previous data source on re-identify', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig());
  await identifyManager(manager);

  const firstDebounceManager = mockDebounceManager;

  await identifyManager(manager);

  expect(createdDataSources[0].close).toHaveBeenCalledTimes(1);
  expect(firstDebounceManager.close).toHaveBeenCalledTimes(1);

  manager.close();
});

it('resolves identify immediately when bootstrap is provided', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig());
  const { resolve } = await identifyManager(manager, { bootstrap: {} });

  expect(resolve).toHaveBeenCalledTimes(1);

  manager.close();
});

it('applies bootstrap data to the flag manager on identify', async () => {
  const flagManager = makeFlagManager();
  const manager = createFDv2DataManagerBase(makeBaseConfig({ flagManager }));
  const bootstrap = {
    'string-flag': 'is bob',
    $flagsState: { 'string-flag': { variation: 1, version: 3 } },
    $valid: true,
  };

  await identifyManager(manager, { bootstrap });

  expect(flagManager.setBootstrap).toHaveBeenCalledWith(expect.anything(), {
    'string-flag': { version: 3, flag: { version: 3, variation: 1, value: 'is bob' } },
  });

  manager.close();
});

it('applies new bootstrap data to the flag manager on re-identify', async () => {
  const flagManager = makeFlagManager();
  const manager = createFDv2DataManagerBase(makeBaseConfig({ flagManager }));

  await identifyManager(manager, {
    bootstrap: {
      'string-flag': 'is bob',
      $flagsState: { 'string-flag': { variation: 1, version: 3 } },
      $valid: true,
    },
  });
  await identifyManager(manager, {
    bootstrap: {
      'string-flag': 'is alice',
      $flagsState: { 'string-flag': { variation: 0, version: 4 } },
      $valid: true,
    },
  });

  expect(flagManager.setBootstrap).toHaveBeenCalledTimes(2);
  expect(flagManager.setBootstrap).toHaveBeenLastCalledWith(expect.anything(), {
    'string-flag': { version: 4, flag: { version: 4, variation: 0, value: 'is alice' } },
  });

  manager.close();
});

it('does not create a data source when bootstrap is used with one-shot mode', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'one-shot' }));
  await identifyManager(manager, { bootstrap: {} });

  // one-shot has no synchronizers, so no data source should be created after bootstrap.
  expect(mockCreateFDv2DataSource).not.toHaveBeenCalled();

  manager.close();
});

it('starts synchronizers when bootstrap is used with streaming mode', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'streaming' }));
  await identifyManager(manager, { bootstrap: {} });

  // streaming has synchronizers, so a data source should be created.
  expect(mockCreateFDv2DataSource).toHaveBeenCalledTimes(1);
  // But with no initializers (bootstrap already provided data).
  const dsConfig = capturedDataSourceConfigs[0];
  expect(dsConfig.initializerFactories).toHaveLength(0);
  expect(dsConfig.synchronizerSlots.length).toBeGreaterThan(0);

  manager.close();
});

it('includes initializers on mode switch when no selector has been obtained', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'one-shot' }));
  await identifyManager(manager);

  // Reset mock to capture second data source creation.
  mockCreateFDv2DataSource.mockClear();

  // Simulate mode switch via reconcile: one-shot -> streaming.
  capturedOnReconcile!({
    networkState: 'available',
    lifecycleState: 'foreground',
    requestedMode: 'streaming',
  });

  expect(mockCreateFDv2DataSource).toHaveBeenCalledTimes(1);
  const dsConfig = capturedDataSourceConfigs[capturedDataSourceConfigs.length - 1];
  // Should include initializers because no selector yet.
  expect(dsConfig.initializerFactories.length).toBeGreaterThan(0);
  expect(dsConfig.synchronizerSlots.length).toBeGreaterThan(0);

  manager.close();
});

it('closes data source on mode switch from streaming to one-shot and updates current mode', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'streaming' }));
  await identifyManager(manager);

  capturedOnReconcile!({
    networkState: 'available',
    lifecycleState: 'foreground',
    requestedMode: 'one-shot',
  });

  expect(createdDataSources[0].close).toHaveBeenCalledTimes(1);
  expect(manager.getCurrentMode()).toBe('one-shot');

  manager.close();
});

it('does nothing on mode switch when mode is unchanged', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'one-shot' }));
  await identifyManager(manager);

  mockCreateFDv2DataSource.mockClear();

  // Reconcile with same mode — should be a no-op.
  capturedOnReconcile!({
    networkState: 'available',
    lifecycleState: 'foreground',
    requestedMode: 'one-shot',
  });

  expect(mockCreateFDv2DataSource).not.toHaveBeenCalled();

  manager.close();
});

it('uses only synchronizers on mode switch after selector has been obtained', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'one-shot' }));
  await identifyManager(manager);

  // Simulate that a selector was obtained via dataCallback.
  const dsConfig = capturedDataSourceConfigs[0];
  dsConfig.dataCallback({ type: 'full', updates: [], state: 'selector-123' });

  mockCreateFDv2DataSource.mockClear();
  capturedDataSourceConfigs = [];

  // Mode switch to streaming.
  capturedOnReconcile!({
    networkState: 'available',
    lifecycleState: 'foreground',
    requestedMode: 'streaming',
  });

  expect(mockCreateFDv2DataSource).toHaveBeenCalledTimes(1);
  const newDsConfig = capturedDataSourceConfigs[0];
  // No initializers because selector is present.
  expect(newDsConfig.initializerFactories).toHaveLength(0);
  expect(newDsConfig.synchronizerSlots.length).toBeGreaterThan(0);

  manager.close();
});

describe('given a manager with streaming as the initial foreground mode', () => {
  let manager: FDv2DataManagerControl;

  beforeEach(() => {
    manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'streaming' }));
  });

  afterEach(() => {
    manager.close();
  });

  it('resolves to streaming when setForcedStreaming is called with true', async () => {
    await identifyManager(manager);

    mockDebounceManager.setRequestedMode.mockClear();
    manager.setForcedStreaming!(true);

    expect(mockDebounceManager.setRequestedMode).toHaveBeenCalledWith('streaming');
  });

  it('resolves to streaming when setForcedStreaming is undefined and automatic is true', async () => {
    await identifyManager(manager);

    mockDebounceManager.setRequestedMode.mockClear();
    manager.setForcedStreaming!(undefined);
    manager.setAutomaticStreamingState!(true);

    expect(mockDebounceManager.setRequestedMode).toHaveBeenLastCalledWith('streaming');
  });

  it('resolves to configured mode when setForcedStreaming is undefined and automatic is false', async () => {
    await identifyManager(manager);

    mockDebounceManager.setRequestedMode.mockClear();
    manager.setForcedStreaming!(undefined);
    manager.setAutomaticStreamingState!(false);

    expect(mockDebounceManager.setRequestedMode).toHaveBeenLastCalledWith('streaming');
  });
});

describe('given a manager with one-shot as the initial foreground mode', () => {
  let manager: FDv2DataManagerControl;

  beforeEach(() => {
    manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'one-shot' }));
  });

  afterEach(() => {
    manager.close();
  });

  it('resolves to streaming when setForcedStreaming is called with true', async () => {
    await identifyManager(manager);

    mockDebounceManager.setRequestedMode.mockClear();
    manager.setForcedStreaming!(true);

    expect(mockDebounceManager.setRequestedMode).toHaveBeenCalledWith('streaming');
  });

  it('resolves to one-shot when setForcedStreaming is called with false', async () => {
    await identifyManager(manager);

    mockDebounceManager.setRequestedMode.mockClear();
    manager.setForcedStreaming!(false);

    expect(mockDebounceManager.setRequestedMode).toHaveBeenCalledWith('one-shot');
  });

  it('resolves to streaming when automatic streaming is true and forced is undefined', async () => {
    await identifyManager(manager);

    mockDebounceManager.setRequestedMode.mockClear();
    manager.setAutomaticStreamingState!(true);

    expect(mockDebounceManager.setRequestedMode).toHaveBeenCalledWith('streaming');
  });

  it('resolves to one-shot when automatic streaming is false and forced is undefined', async () => {
    await identifyManager(manager);

    mockDebounceManager.setRequestedMode.mockClear();
    manager.setAutomaticStreamingState!(false);

    expect(mockDebounceManager.setRequestedMode).toHaveBeenCalledWith('one-shot');
  });
});

it('falls back to one-shot when setForcedStreaming is false and configured mode is streaming', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'streaming' }));
  await identifyManager(manager);

  mockDebounceManager.setRequestedMode.mockClear();
  manager.setForcedStreaming!(false);

  // forced=false and configured=streaming -> falls back to one-shot.
  expect(mockDebounceManager.setRequestedMode).toHaveBeenCalledWith('one-shot');

  manager.close();
});

it('triggers flush callback when lifecycle transitions to background', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig());
  const flushCallback = jest.fn();
  manager.setFlushCallback(flushCallback);

  await identifyManager(manager);

  manager.setLifecycleState('background');

  expect(flushCallback).toHaveBeenCalledTimes(1);

  manager.close();
});

it('does not trigger flush callback when lifecycle is already background', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig());
  const flushCallback = jest.fn();
  manager.setFlushCallback(flushCallback);

  await identifyManager(manager);

  manager.setLifecycleState('background');
  flushCallback.mockClear();

  // Setting background again should not flush.
  manager.setLifecycleState('background');
  expect(flushCallback).not.toHaveBeenCalled();

  manager.close();
});

it('delegates setNetworkState to debounce manager', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig());
  await identifyManager(manager);

  manager.setNetworkState('unavailable');

  expect(mockDebounceManager.setNetworkState).toHaveBeenCalledWith('unavailable');

  manager.close();
});

it('delegates setLifecycleState to debounce manager', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig());
  await identifyManager(manager);

  manager.setLifecycleState('background');

  expect(mockDebounceManager.setLifecycleState).toHaveBeenCalledWith('background');

  manager.close();
});

it('setConnectionMode overrides all automatic behavior', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'streaming' }));
  await identifyManager(manager);

  mockDebounceManager.setRequestedMode.mockClear();
  manager.setConnectionMode('polling');

  expect(mockDebounceManager.setRequestedMode).toHaveBeenCalledWith('polling');

  manager.close();
});

it('setConnectionMode overrides forced streaming', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'one-shot' }));
  await identifyManager(manager);

  manager.setForcedStreaming!(true);
  mockDebounceManager.setRequestedMode.mockClear();

  manager.setConnectionMode('polling');

  expect(mockDebounceManager.setRequestedMode).toHaveBeenCalledWith('polling');

  // onReconcile should resolve to 'polling' (override bypasses transition table)
  capturedOnReconcile!({
    networkState: 'available',
    lifecycleState: 'foreground',
    requestedMode: 'polling',
  });
  expect(manager.getCurrentMode()).toBe('polling');

  manager.close();
});

it('clearing setConnectionMode returns to streaming logic', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'one-shot' }));
  await identifyManager(manager);

  manager.setForcedStreaming!(true);
  manager.setConnectionMode('polling');
  mockDebounceManager.setRequestedMode.mockClear();

  // Clear the override — should fall back to forced streaming
  manager.setConnectionMode(undefined);

  expect(mockDebounceManager.setRequestedMode).toHaveBeenCalledWith('streaming');

  manager.close();
});

it('setConnectionMode override bypasses network unavailable', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'streaming' }));
  await identifyManager(manager);

  manager.setConnectionMode('streaming');

  // Even though network is unavailable, the override should win
  capturedOnReconcile!({
    networkState: 'unavailable',
    lifecycleState: 'foreground',
    requestedMode: 'streaming',
  });
  expect(manager.getCurrentMode()).toBe('streaming');

  manager.close();
});

it('skips cache initializer on mode switch when bootstrapped', async () => {
  const sourceFactoryProvider = makeSourceFactoryProvider();
  const manager = createFDv2DataManagerBase(
    makeBaseConfig({
      foregroundMode: 'streaming',
      sourceFactoryProvider,
    }),
  );

  await identifyManager(manager, { bootstrap: {} });

  // After bootstrap identify, the data source was created for streaming
  // synchronizers only (no initializers).
  sourceFactoryProvider.createInitializerFactory.mockClear();

  // Now simulate a mode switch that would include initializers.
  mockCreateFDv2DataSource.mockClear();
  capturedDataSourceConfigs = [];

  // Switch to polling (which has cache initializer).
  capturedOnReconcile!({
    networkState: 'available',
    lifecycleState: 'foreground',
    requestedMode: 'polling',
  });

  // Verify that 'cache' type was NOT passed to createInitializerFactory.
  const cacheInitCalls = sourceFactoryProvider.createInitializerFactory.mock.calls.filter(
    (call: any[]) => call[0].type === 'cache',
  );
  expect(cacheInitCalls).toHaveLength(0);

  manager.close();
});

it('adds withReasons query param when config.withReasons is true', async () => {
  const buildQueryParams = jest.fn(() => [{ key: 'auth', value: 'test-credential' }]);
  const manager = createFDv2DataManagerBase(
    makeBaseConfig({
      config: makeConfig({ withReasons: true }),
      buildQueryParams,
    }),
  );

  await identifyManager(manager);

  // The requestor should have been created with withReasons param.
  // Check that makeFDv2Requestor was called and the queryParams include withReasons.
  expect(mockMakeFDv2Requestor).toHaveBeenCalledTimes(1);
  const queryParams = mockMakeFDv2Requestor.mock.calls[0][6];
  expect(queryParams).toContainEqual({ key: 'withReasons', value: 'true' });

  manager.close();
});

it('passes usePost to the requestor and the source factory context', async () => {
  const sourceFactoryProvider = makeSourceFactoryProvider();
  const manager = createFDv2DataManagerBase(
    makeBaseConfig({
      config: makeConfig({ usePost: true }),
      sourceFactoryProvider,
    }),
  );

  await identifyManager(manager);

  expect(mockMakeFDv2Requestor).toHaveBeenCalledTimes(1);
  expect(mockMakeFDv2Requestor.mock.calls[0][7]).toBe(true);

  const factoryContexts = [
    ...(sourceFactoryProvider.createInitializerFactory as jest.Mock).mock.calls,
    ...(sourceFactoryProvider.createSynchronizerSlot as jest.Mock).mock.calls,
  ].map((call) => call[1]);
  expect(factoryContexts.length).toBeGreaterThan(0);
  factoryContexts.forEach((ctx) => expect(ctx.usePost).toBe(true));

  manager.close();
});

it('closes data source and debounce manager on close', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig());
  await identifyManager(manager);

  manager.close();

  expect(createdDataSources[0].close).toHaveBeenCalledTimes(1);
  expect(mockDebounceManager.close).toHaveBeenCalledTimes(1);
});

it('does not create data source after close', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig());
  await identifyManager(manager);

  manager.close();
  mockCreateFDv2DataSource.mockClear();

  // Attempt to identify after close.
  const resolve = jest.fn();
  const reject = jest.fn();
  await manager.identify(resolve, reject, makeContext());

  expect(mockCreateFDv2DataSource).not.toHaveBeenCalled();
});

it('resolves identify when data source start completes', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig());
  const { resolve, reject } = await identifyManager(manager);

  expect(resolve).toHaveBeenCalledTimes(1);
  expect(reject).not.toHaveBeenCalled();

  manager.close();
});

it('rejects identify when data source start fails', async () => {
  autoResolveStart = false;
  const manager = createFDv2DataManagerBase(makeBaseConfig());
  const { resolve, reject } = await identifyManager(manager);

  const error = new Error('start failed');
  createdDataSources[0].rejectStart(error);
  await flushPromises();

  expect(resolve).not.toHaveBeenCalled();
  expect(reject).toHaveBeenCalledTimes(1);
  expect(reject).toHaveBeenCalledWith(error);

  manager.close();
});

it('exposes configuredForegroundMode from the initial config', () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'polling' }));

  expect(manager.configuredForegroundMode).toBe('polling');

  manager.close();
});

it('reports the initial resolved mode via getCurrentMode', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'one-shot' }));
  await identifyManager(manager);

  expect(manager.getCurrentMode()).toBe('one-shot');

  manager.close();
});

it('does not reconcile after close', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig());
  await identifyManager(manager);

  manager.close();
  mockCreateFDv2DataSource.mockClear();

  // Calling onReconcile after close should be a no-op.
  capturedOnReconcile?.({
    networkState: 'available',
    lifecycleState: 'foreground',
    requestedMode: 'streaming',
  });

  expect(mockCreateFDv2DataSource).not.toHaveBeenCalled();
});

it('resolves to offline when network is unavailable via reconcile', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'streaming' }));
  await identifyManager(manager);

  mockCreateFDv2DataSource.mockClear();

  capturedOnReconcile!({
    networkState: 'unavailable',
    lifecycleState: 'foreground',
    requestedMode: 'streaming',
  });

  // Should close previous data source.
  expect(createdDataSources[0].close).toHaveBeenCalledTimes(1);
  // Offline mode resolves via the browser transition table.
  expect(manager.getCurrentMode()).toBe('offline');

  manager.close();
});

it('sets up debounce manager with correct initial state after identify', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'streaming' }));
  await identifyManager(manager);

  expect(mockCreateStateDebounceManager).toHaveBeenCalledTimes(1);
  const config = mockCreateStateDebounceManager.mock.calls[0][0];
  expect(config.initialState).toEqual({
    networkState: 'available',
    lifecycleState: 'foreground',
    requestedMode: 'streaming',
  });
  expect(config.onReconcile).toBeInstanceOf(Function);

  manager.close();
});

it('calls flagManager.applyChanges with type full for a full payload', async () => {
  const flagManager = makeFlagManager();
  const manager = createFDv2DataManagerBase(makeBaseConfig({ flagManager }));
  await identifyManager(manager);

  const dsConfig = capturedDataSourceConfigs[0];
  dsConfig.dataCallback({
    type: 'full',
    updates: [{ kind: 'flag-eval', key: 'flag1', version: 1, object: { value: true } }],
    state: 'selector-1',
  });

  expect(flagManager.applyChanges).toHaveBeenCalledTimes(1);
  expect(flagManager.applyChanges).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    'full',
  );

  manager.close();
});

it('calls flagManager.applyChanges with type partial for a partial payload', async () => {
  const flagManager = makeFlagManager();
  const manager = createFDv2DataManagerBase(makeBaseConfig({ flagManager }));
  await identifyManager(manager);

  const dsConfig = capturedDataSourceConfigs[0];
  dsConfig.dataCallback({
    type: 'partial',
    updates: [{ kind: 'flag-eval', key: 'flag1', version: 2, object: { value: false } }],
    state: 'selector-2',
  });

  expect(flagManager.applyChanges).toHaveBeenCalledTimes(1);
  expect(flagManager.applyChanges).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    'partial',
  );

  manager.close();
});

it('calls flagManager.applyChanges with type none on none payload to update freshness', async () => {
  const flagManager = makeFlagManager();
  const manager = createFDv2DataManagerBase(makeBaseConfig({ flagManager }));
  await identifyManager(manager);

  const dsConfig = capturedDataSourceConfigs[0];
  dsConfig.dataCallback({
    type: 'none',
    updates: [],
  });

  // Spec 5.2.2: transfer-none confirms data is still current.
  // applyChanges with type none persists cache (updating freshness).
  expect(flagManager.applyChanges).toHaveBeenCalledTimes(1);
  expect(flagManager.applyChanges).toHaveBeenCalledWith(expect.anything(), {}, 'none');

  manager.close();
});

it('stores selector from payload state for subsequent data source creations', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'one-shot' }));
  await identifyManager(manager);

  // Deliver a payload with a selector, then a subsequent none payload
  // (no state, matching what a real transfer-none response carries) --
  // the none payload must not clear the selector obtained above.
  const dsConfig = capturedDataSourceConfigs[0];
  dsConfig.dataCallback({ type: 'full', updates: [], state: 'my-selector' });
  dsConfig.dataCallback({ type: 'none', updates: [] });

  // Now switch mode. Since selector exists, no initializers.
  mockCreateFDv2DataSource.mockClear();
  capturedDataSourceConfigs = [];

  capturedOnReconcile!({
    networkState: 'available',
    lifecycleState: 'foreground',
    requestedMode: 'streaming',
  });

  if (capturedDataSourceConfigs.length > 0) {
    expect(capturedDataSourceConfigs[0].initializerFactories).toHaveLength(0);
  }

  manager.close();
});

it('does not clear a previously obtained selector on a none payload', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'one-shot' }));
  await identifyManager(manager);

  const dsConfig = capturedDataSourceConfigs[0];

  // A full payload establishes a selector.
  dsConfig.dataCallback({ type: 'full', updates: [], state: 'S1' });
  expect(dsConfig.selectorGetter()).toBe('S1');

  // A none payload (e.g. an HTTP 304) never carries a state -- it must not
  // wipe the selector obtained from the previous full payload.
  dsConfig.dataCallback({ type: 'none', updates: [] });
  expect(dsConfig.selectorGetter()).toBe('S1');

  manager.close();
});

it('warns and skips unsupported initializer entry types', async () => {
  const sourceFactoryProvider = makeSourceFactoryProvider();
  // Return undefined for one entry to trigger the warning path.
  // @ts-ignore - mock returns undefined for unsupported types
  sourceFactoryProvider.createInitializerFactory.mockImplementation((entry: any) =>
    entry.type === 'polling' ? jest.fn() : undefined,
  );
  const cfg = makeConfig();
  const manager = createFDv2DataManagerBase(
    makeBaseConfig({
      config: cfg,
      sourceFactoryProvider,
      // Use streaming mode which has cache + polling initializers.
      foregroundMode: 'streaming',
    }),
  );
  await identifyManager(manager);

  // cache entry returns undefined → warning logged.
  expect(cfg.logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('Unsupported initializer type'),
  );

  manager.close();
});

it('warns and skips unsupported synchronizer entry types', async () => {
  const sourceFactoryProvider = makeSourceFactoryProvider();
  // Return undefined for all synchronizer entries to trigger the warning path.
  // @ts-ignore - mock returns undefined for unsupported types
  sourceFactoryProvider.createSynchronizerSlot.mockReturnValue(undefined);
  const cfg = makeConfig();
  const manager = createFDv2DataManagerBase(
    makeBaseConfig({
      config: cfg,
      sourceFactoryProvider,
      // streaming mode has streaming + polling synchronizers.
      foregroundMode: 'streaming',
    }),
  );
  await identifyManager(manager);

  expect(cfg.logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('Unsupported synchronizer type'),
  );

  manager.close();
});

it('appends a blocked FDv1 fallback synchronizer when fdv1Endpoints are configured', async () => {
  const sourceFactoryProvider = makeSourceFactoryProvider();
  const fdv1Endpoints = {
    polling: jest.fn(() => ({
      pathGet: jest.fn(),
      pathReport: jest.fn(),
      pathPost: jest.fn(),
      pathPing: jest.fn(),
    })),
    streaming: jest.fn(() => ({
      pathGet: jest.fn(),
      pathReport: jest.fn(),
      pathPost: jest.fn(),
      pathPing: jest.fn(),
    })),
  };

  (makeRequestor as jest.Mock).mockReturnValue({});
  (createFDv1PollingSynchronizer as jest.Mock).mockReturnValue({ close: jest.fn() });

  const manager = createFDv2DataManagerBase(
    makeBaseConfig({
      sourceFactoryProvider,
      fdv1Endpoints,
      // streaming mode has synchronizers, so FDv1 fallback will be appended.
      foregroundMode: 'streaming',
    }),
  );
  await identifyManager(manager);

  const dsConfig = capturedDataSourceConfigs[0];
  // The last synchronizer slot should be the FDv1 fallback (blocked).
  const lastSlot = dsConfig.synchronizerSlots[dsConfig.synchronizerSlots.length - 1];
  expect(lastSlot.isFDv1Fallback).toBe(true);
  expect(lastSlot.state).toBe('blocked');

  manager.close();
});

it('uses REPORT for the FDv1 fallback requestor when usePost is set', async () => {
  const sourceFactoryProvider = makeSourceFactoryProvider();
  const fdv1Endpoints = {
    polling: jest.fn(() => ({
      pathGet: jest.fn(),
      pathReport: jest.fn(),
      pathPost: jest.fn(),
      pathPing: jest.fn(),
    })),
    streaming: jest.fn(() => ({
      pathGet: jest.fn(),
      pathReport: jest.fn(),
      pathPost: jest.fn(),
      pathPing: jest.fn(),
    })),
  };

  (makeRequestor as jest.Mock).mockReturnValue({});
  (createFDv1PollingSynchronizer as jest.Mock).mockReturnValue({ close: jest.fn() });

  const manager = createFDv2DataManagerBase(
    makeBaseConfig({
      config: makeConfig({ usePost: true }),
      sourceFactoryProvider,
      fdv1Endpoints,
      foregroundMode: 'streaming',
    }),
  );
  await identifyManager(manager);

  const dsConfig = capturedDataSourceConfigs[0];
  const fdv1Slot = dsConfig.synchronizerSlots[dsConfig.synchronizerSlots.length - 1];
  // Invoke the factory to trigger requestor creation.
  fdv1Slot.factory.create(() => undefined);

  expect(makeRequestor).toHaveBeenCalledTimes(1);
  // The useReport argument of makeRequestor controls the REPORT method.
  expect((makeRequestor as jest.Mock).mock.calls[0][8]).toBe(true);

  manager.close();
});

it('uses per-mode fdv1Fallback pollInterval from MODE_TABLE for background mode', async () => {
  const sourceFactoryProvider = makeSourceFactoryProvider();
  const fdv1Endpoints = {
    polling: jest.fn(() => ({
      pathGet: jest.fn(),
      pathReport: jest.fn(),
      pathPost: jest.fn(),
      pathPing: jest.fn(),
    })),
    streaming: jest.fn(() => ({
      pathGet: jest.fn(),
      pathReport: jest.fn(),
      pathPost: jest.fn(),
      pathPing: jest.fn(),
    })),
  };

  (makeRequestor as jest.Mock).mockReturnValue({});
  (createFDv1PollingSynchronizer as jest.Mock).mockReturnValue({ close: jest.fn() });

  const manager = createFDv2DataManagerBase(
    makeBaseConfig({
      sourceFactoryProvider,
      fdv1Endpoints,
      foregroundMode: 'background',
    }),
  );
  await identifyManager(manager);

  const dsConfig = capturedDataSourceConfigs[0];
  const fdv1Slot = dsConfig.synchronizerSlots[dsConfig.synchronizerSlots.length - 1];
  // Invoke the factory to trigger createFDv1PollingSynchronizer.
  fdv1Slot.factory.create(() => undefined);

  // The FDv1 fallback synchronizer should use background's default (3600s = 3600000ms).
  expect(createFDv1PollingSynchronizer).toHaveBeenCalledWith(
    expect.anything(),
    3600 * 1000,
    expect.anything(),
  );

  manager.close();
});

it('resolves identify immediately when initial mode has no sources', async () => {
  // Use a custom mode table where the initial mode has empty initializers and synchronizers.
  const sourceFactoryProvider = makeSourceFactoryProvider();
  // @ts-ignore - mock returns undefined for unsupported types
  sourceFactoryProvider.createInitializerFactory.mockReturnValue(undefined);
  // @ts-ignore - mock returns undefined for unsupported types
  sourceFactoryProvider.createSynchronizerSlot.mockReturnValue(undefined);

  const manager = createFDv2DataManagerBase(
    makeBaseConfig({
      sourceFactoryProvider,
      // offline mode: [cache] initializer, [] synchronizers.
      // With provider returning undefined for cache, both arrays are empty.
      foregroundMode: 'offline',
    }),
  );

  const { resolve } = await identifyManager(manager);

  // Should resolve immediately — offline with no sources.
  expect(resolve).toHaveBeenCalledTimes(1);
  // No data source should have been created.
  expect(mockCreateFDv2DataSource).not.toHaveBeenCalled();

  manager.close();
});

it('builds offline mode with a cache-marked initializer factory and no synchronizers', async () => {
  // Verifies that the offline mode passes an isCache-marked factory to the
  // data source. FDv2DataSource is responsible for recognizing this
  // cache-only configuration and completing initialization on a cache miss.
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'offline' }));

  const { resolve, reject } = await identifyManager(manager);

  expect(resolve).toHaveBeenCalledTimes(1);
  expect(reject).not.toHaveBeenCalled();

  const dsConfig = capturedDataSourceConfigs[0];
  expect(dsConfig.synchronizerSlots).toEqual([]);
  expect(dsConfig.initializerFactories).toHaveLength(1);
  expect(dsConfig.initializerFactories[0].isCache).toBe(true);

  manager.close();
});

it('does not identify after close', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig());
  manager.close();

  const cfg = makeConfig();
  // Re-create with our logger to check debug message.
  const manager2 = createFDv2DataManagerBase(makeBaseConfig({ config: cfg }));
  await identifyManager(manager2);
  manager2.close();

  // Now close and try to identify.
  mockCreateFDv2DataSource.mockClear();
  const resolve = jest.fn();
  const reject = jest.fn();
  await manager2.identify(resolve, reject, makeContext());

  // After close, identify should be a no-op.
  expect(resolve).not.toHaveBeenCalled();
  expect(cfg.logger.debug).toHaveBeenCalledWith(
    expect.stringContaining('Identify called after close'),
  );
});

it('populates polling and streaming config in the factory context', async () => {
  const sourceFactoryProvider = makeSourceFactoryProvider();
  let capturedCtx: any;
  // @ts-ignore - mock captures ctx argument
  sourceFactoryProvider.createInitializerFactory.mockImplementation((_entry: any, ctx: any) => {
    capturedCtx = ctx;
    return jest.fn();
  });

  const manager = createFDv2DataManagerBase(makeBaseConfig({ sourceFactoryProvider }));
  await identifyManager(manager);

  expect(capturedCtx.polling).toBeDefined();
  expect(capturedCtx.polling.paths).toBeDefined();
  expect(capturedCtx.polling.intervalSeconds).toBeDefined();
  expect(capturedCtx.streaming).toBeDefined();
  expect(capturedCtx.streaming.paths).toBeDefined();
  expect(capturedCtx.streaming.initialReconnectDelaySeconds).toBeDefined();

  manager.close();
});

it('warns when a payload filter key is configured', () => {
  const config = makeConfig({
    serviceEndpoints: new ServiceEndpoints(
      'https://stream',
      'https://poll',
      'https://events',
      '/bulk',
      '/diagnostic',
      true,
      'microservice-1',
    ),
  });

  const manager = createFDv2DataManagerBase(makeBaseConfig({ config }));

  expect(config.logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('Payload filtering is not supported with the FDv2 data system'),
  );

  manager.close();
});

it('does not warn when no payload filter key is configured', () => {
  const config = makeConfig();

  const manager = createFDv2DataManagerBase(makeBaseConfig({ config }));

  expect(config.logger.warn).not.toHaveBeenCalled();

  manager.close();
});

function useActualDataSources() {
  const actual = jest.requireActual('../../src/datasource/fdv2/FDv2DataSource');
  mockCreateFDv2DataSource.mockImplementation((cfg: any) => {
    capturedDataSourceConfigs.push(cfg);
    return actual.createFDv2DataSource(cfg);
  });
}

// The cache initializer of this provider always reports a cache miss.
function makeCacheMissSourceFactoryProvider() {
  const provider = makeSourceFactoryProvider();
  provider.createInitializerFactory.mockImplementation((entry: any) => {
    if (entry?.type !== 'cache') {
      return { create: jest.fn() };
    }
    return {
      isCache: true,
      create: jest.fn(() => ({
        run: jest.fn(async () => ({
          type: 'changeSet',
          payload: { version: 0, type: 'none', updates: [] },
          fdv1Fallback: false,
        })),
        close: jest.fn(),
      })),
    } as any;
  });
  return provider;
}

it('completes a pending identify from the new data source after a mode switch', async () => {
  autoResolveStart = false;
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'polling' }));
  const { resolve, reject } = await identifyManager(manager, { waitForNetworkResults: true });

  capturedOnReconcile!({
    networkState: 'available',
    lifecycleState: 'foreground',
    requestedMode: 'streaming',
  });
  await flushPromises();

  expect(createdDataSources).toHaveLength(2);
  expect(createdDataSources[0].close).toHaveBeenCalledTimes(1);
  expect(resolve).not.toHaveBeenCalled();
  expect(reject).not.toHaveBeenCalled();

  createdDataSources[1].resolveStart();
  await flushPromises();

  expect(resolve).toHaveBeenCalledTimes(1);
  expect(reject).not.toHaveBeenCalled();

  manager.close();
});

it('completes a pending identify with defaults after a switch to offline with no cached data', async () => {
  autoResolveStart = false;
  const flagManager = makeFlagManager();
  const manager = createFDv2DataManagerBase(
    makeBaseConfig({
      foregroundMode: 'polling',
      flagManager,
      sourceFactoryProvider: makeCacheMissSourceFactoryProvider(),
    }),
  );
  const { resolve, reject } = await identifyManager(manager, { waitForNetworkResults: true });

  useActualDataSources();
  capturedOnReconcile!({
    networkState: 'unavailable',
    lifecycleState: 'foreground',
    requestedMode: 'polling',
  });
  await flushPromises();

  expect(manager.getCurrentMode()).toBe('offline');
  expect(createdDataSources[0].close).toHaveBeenCalledTimes(1);
  expect(resolve).toHaveBeenCalledTimes(1);
  expect(reject).not.toHaveBeenCalled();
  expect(flagManager.applyChanges).not.toHaveBeenCalled();

  manager.close();
});

it('does not fail a new identify when the previous data source closes before it initializes', async () => {
  autoResolveStart = false;
  const manager = createFDv2DataManagerBase(makeBaseConfig({ foregroundMode: 'polling' }));

  // Identify A completes from cached data while its data source still initializes.
  const first = await identifyManager(manager);
  capturedDataSourceConfigs[0].dataCallback({ version: 0, type: 'full', updates: [] });
  expect(first.resolve).toHaveBeenCalledTimes(1);

  // Identify B closes the data source of identify A.
  const second = await identifyManager(manager, { waitForNetworkResults: true });
  await flushPromises();

  expect(createdDataSources).toHaveLength(2);
  expect(createdDataSources[0].close).toHaveBeenCalledTimes(1);
  expect(second.resolve).not.toHaveBeenCalled();
  expect(second.reject).not.toHaveBeenCalled();

  createdDataSources[1].resolveStart();
  await flushPromises();

  expect(second.resolve).toHaveBeenCalledTimes(1);
  expect(second.reject).not.toHaveBeenCalled();
  expect(first.reject).not.toHaveBeenCalled();

  manager.close();
});
