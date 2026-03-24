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
    applyChanges: jest.fn(),
    get: jest.fn(),
    getAll: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  } as any;
}

function makeSourceFactoryProvider() {
  return {
    createInitializerFactory: jest.fn((_entry: any) => jest.fn()),
    createSynchronizerSlot: jest.fn((_entry: any) => createSynchronizerSlot(jest.fn())),
  };
}

// Captured config and callbacks from mocks.
let capturedDataSourceConfigs: any[];
let capturedOnReconcile: ((pendingState: PendingState) => void) | undefined;
let mockDataSource: { start: jest.Mock; close: jest.Mock };
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

  mockDataSource = {
    start: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  };

  mockCreateFDv2DataSource.mockImplementation((cfg: any) => {
    capturedDataSourceConfigs.push(cfg);
    return mockDataSource;
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

it('creates a data source for the resolved mode on identify', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig());
  await identifyManager(manager);

  expect(mockCreateFDv2DataSource).toHaveBeenCalledTimes(1);
  expect(mockDataSource.start).toHaveBeenCalledTimes(1);

  manager.close();
});

it('tears down the previous data source on re-identify', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig());
  await identifyManager(manager);

  const firstDataSource = mockDataSource;
  const firstDebounceManager = mockDebounceManager;

  // Create new mocks for second identify.
  mockDataSource = {
    start: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  };

  await identifyManager(manager);

  expect(firstDataSource.close).toHaveBeenCalledTimes(1);
  expect(firstDebounceManager.close).toHaveBeenCalledTimes(1);

  manager.close();
});

it('resolves identify immediately when bootstrap is provided', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig());
  const { resolve } = await identifyManager(manager, { bootstrap: {} });

  expect(resolve).toHaveBeenCalledTimes(1);

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
  mockDataSource = {
    start: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  };
  mockCreateFDv2DataSource.mockImplementation((cfg: any) => {
    capturedDataSourceConfigs.push(cfg);
    return mockDataSource;
  });

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

  const firstDataSource = mockDataSource;

  mockCreateFDv2DataSource.mockClear();
  // one-shot post-init has no sources, so createFDv2DataSource won't be called again
  // because includeInitializers will be true (no selector) but the factories will be built.
  // Actually, one-shot has initializers and no synchronizers. Since no selector, initializers included.
  mockDataSource = {
    start: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  };
  mockCreateFDv2DataSource.mockImplementation((cfg: any) => {
    capturedDataSourceConfigs.push(cfg);
    return mockDataSource;
  });

  capturedOnReconcile!({
    networkState: 'available',
    lifecycleState: 'foreground',
    requestedMode: 'one-shot',
  });

  expect(firstDataSource.close).toHaveBeenCalledTimes(1);
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
  mockDataSource = {
    start: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  };
  mockCreateFDv2DataSource.mockImplementation((cfg: any) => {
    capturedDataSourceConfigs.push(cfg);
    return mockDataSource;
  });

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

it('delegates setRequestedMode to debounce manager', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig());
  await identifyManager(manager);

  manager.setRequestedMode('streaming');

  expect(mockDebounceManager.setRequestedMode).toHaveBeenCalledWith('streaming');

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
  mockDataSource = {
    start: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  };
  mockCreateFDv2DataSource.mockImplementation((cfg: any) => {
    capturedDataSourceConfigs.push(cfg);
    return mockDataSource;
  });

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

it('closes data source and debounce manager on close', async () => {
  const manager = createFDv2DataManagerBase(makeBaseConfig());
  await identifyManager(manager);

  manager.close();

  expect(mockDataSource.close).toHaveBeenCalledTimes(1);
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
  const error = new Error('start failed');
  mockDataSource.start.mockRejectedValueOnce(error);

  const manager = createFDv2DataManagerBase(makeBaseConfig());
  const resolve = jest.fn();
  const reject = jest.fn();
  await manager.identify(resolve, reject, makeContext());
  // Flush microtasks for the rejected promise.
  await Promise.resolve();
  await Promise.resolve();

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

  const firstDataSource = mockDataSource;
  mockCreateFDv2DataSource.mockClear();

  capturedOnReconcile!({
    networkState: 'unavailable',
    lifecycleState: 'foreground',
    requestedMode: 'streaming',
  });

  // Should close previous data source.
  expect(firstDataSource.close).toHaveBeenCalledTimes(1);
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
    state: 'selector-3',
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

  // Deliver a payload with a selector.
  const dsConfig = capturedDataSourceConfigs[0];
  dsConfig.dataCallback({ type: 'none', updates: [], state: 'my-selector' });

  // Now switch mode. Since selector exists, no initializers.
  mockCreateFDv2DataSource.mockClear();
  capturedDataSourceConfigs = [];
  mockDataSource = {
    start: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  };
  mockCreateFDv2DataSource.mockImplementation((cfg: any) => {
    capturedDataSourceConfigs.push(cfg);
    return mockDataSource;
  });

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
