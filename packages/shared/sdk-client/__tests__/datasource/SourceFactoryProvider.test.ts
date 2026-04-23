import {
  Context,
  Crypto,
  Encoding,
  LDLogger,
  Requests,
  ServiceEndpoints,
} from '@launchdarkly/js-sdk-common';

import { InitializerEntry, SynchronizerEntry } from '../../src/api/datasource';
import { DataSourcePaths } from '../../src/datasource/DataSourceConfig';
import { createCacheInitializerFactory } from '../../src/datasource/fdv2/CacheInitializer';
import { FDv2Requestor, makeFDv2Requestor } from '../../src/datasource/fdv2/FDv2Requestor';
import { poll as fdv2Poll } from '../../src/datasource/fdv2/PollingBase';
import { createPollingInitializer } from '../../src/datasource/fdv2/PollingInitializer';
import { createPollingSynchronizer } from '../../src/datasource/fdv2/PollingSynchronizer';
import { createSynchronizerSlot } from '../../src/datasource/fdv2/SourceManager';
import { createStreamingBase } from '../../src/datasource/fdv2/StreamingFDv2Base';
import { createStreamingInitializer } from '../../src/datasource/fdv2/StreamingInitializerFDv2';
import { createStreamingSynchronizer } from '../../src/datasource/fdv2/StreamingSynchronizerFDv2';
import {
  createDefaultSourceFactoryProvider,
  SourceFactoryContext,
} from '../../src/datasource/SourceFactoryProvider';

jest.mock('../../src/datasource/fdv2/PollingInitializer');
jest.mock('../../src/datasource/fdv2/PollingSynchronizer');
jest.mock('../../src/datasource/fdv2/StreamingFDv2Base');
jest.mock('../../src/datasource/fdv2/StreamingInitializerFDv2');
jest.mock('../../src/datasource/fdv2/StreamingSynchronizerFDv2');
jest.mock('../../src/datasource/fdv2/CacheInitializer');
jest.mock('../../src/datasource/fdv2/FDv2Requestor');
jest.mock('../../src/datasource/fdv2/PollingBase');

const mockCreatePollingInitializer = createPollingInitializer as jest.Mock;
const mockCreatePollingSynchronizer = createPollingSynchronizer as jest.Mock;
const mockCreateStreamingBase = createStreamingBase as jest.Mock;
const mockCreateStreamingInitializer = createStreamingInitializer as jest.Mock;
const mockCreateStreamingSynchronizer = createStreamingSynchronizer as jest.Mock;
const mockCreateCacheInitializerFactory = createCacheInitializerFactory as jest.Mock;
const mockMakeFDv2Requestor = makeFDv2Requestor as jest.Mock;
const mockCreateSynchronizerSlot = createSynchronizerSlot as jest.Mock;
const mockFdv2Poll = fdv2Poll as jest.Mock;

jest.mock('../../src/datasource/fdv2/SourceManager', () => ({
  createSynchronizerSlot: jest.fn((factory: any) => ({
    factory,
    isFDv1Fallback: false,
    state: 'available',
  })),
}));

function makeContext(): Context {
  return Context.fromLDContext({ kind: 'user', key: 'test-user' });
}

function makePaths(): DataSourcePaths {
  return {
    pathGet: jest.fn().mockReturnValue('/eval/test-path'),
    pathReport: jest.fn().mockReturnValue('/eval/report-path'),
    pathPost: jest.fn().mockReturnValue('/eval/post-path'),
    pathPing: jest.fn().mockReturnValue('/eval/ping-path'),
  };
}

function makeSourceFactoryContext(overrides?: Partial<SourceFactoryContext>): SourceFactoryContext {
  return {
    requestor: { poll: jest.fn() } as unknown as FDv2Requestor,
    requests: {} as Requests,
    encoding: {} as Encoding,
    serviceEndpoints: new ServiceEndpoints(
      'https://stream.example.com',
      'https://poll.example.com',
      'https://events.example.com',
    ),
    baseHeaders: { authorization: 'sdk-key' },
    queryParams: [],
    plainContextString: '{"kind":"user","key":"test-user"}',
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as LDLogger,
    polling: {
      paths: makePaths(),
      intervalSeconds: 30,
    },
    streaming: {
      paths: makePaths(),
      initialReconnectDelaySeconds: 1,
    },
    storage: undefined,
    crypto: {} as Crypto,
    environmentNamespace: 'test-env',
    context: makeContext(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreatePollingInitializer.mockReturnValue({ close: jest.fn() });
  mockCreatePollingSynchronizer.mockReturnValue({ close: jest.fn() });
  mockCreateStreamingBase.mockReturnValue({
    start: jest.fn(),
    close: jest.fn(),
    takeResult: jest.fn(),
  });
  mockCreateStreamingInitializer.mockReturnValue({ close: jest.fn() });
  mockCreateStreamingSynchronizer.mockReturnValue({ close: jest.fn() });
  mockCreateCacheInitializerFactory.mockReturnValue({ create: jest.fn(), isCache: true });
  mockMakeFDv2Requestor.mockReturnValue({ poll: jest.fn() });
});

// --- createInitializerFactory ---

it('creates a PollingInitializer for a polling initializer entry', () => {
  const provider = createDefaultSourceFactoryProvider();
  const ctx = makeSourceFactoryContext();
  const entry: InitializerEntry = { type: 'polling' };

  const factory = provider.createInitializerFactory(entry, ctx);

  expect(factory).toBeDefined();
  const selectorGetter = () => 'some-selector';
  factory!.create(selectorGetter);
  expect(mockCreatePollingInitializer).toHaveBeenCalledWith(
    ctx.requestor,
    ctx.logger,
    selectorGetter,
  );
});

it('creates a StreamingInitializer for a streaming initializer entry', () => {
  const provider = createDefaultSourceFactoryProvider();
  const ctx = makeSourceFactoryContext();
  const entry: InitializerEntry = { type: 'streaming' };

  const factory = provider.createInitializerFactory(entry, ctx);

  expect(factory).toBeDefined();
  const selectorGetter = () => 'some-selector';
  factory!.create(selectorGetter);
  expect(mockCreateStreamingBase).toHaveBeenCalledWith(
    expect.objectContaining({
      requests: ctx.requests,
      serviceEndpoints: ctx.serviceEndpoints,
      initialRetryDelayMillis: ctx.streaming.initialReconnectDelaySeconds * 1000,
    }),
  );
  expect(mockCreateStreamingInitializer).toHaveBeenCalledWith(
    mockCreateStreamingBase.mock.results[0].value,
  );
});

it('creates a CacheInitializer for a cache initializer entry', () => {
  const provider = createDefaultSourceFactoryProvider();
  const ctx = makeSourceFactoryContext();
  const entry: InitializerEntry = { type: 'cache' };

  const factory = provider.createInitializerFactory(entry, ctx);

  expect(mockCreateCacheInitializerFactory).toHaveBeenCalledWith({
    storage: ctx.storage,
    crypto: ctx.crypto,
    environmentNamespace: ctx.environmentNamespace,
    context: ctx.context,
    logger: ctx.logger,
  });
  expect(factory).toBe(mockCreateCacheInitializerFactory.mock.results[0].value);
  expect(factory!.isCache).toBe(true);
});

it('returns undefined for an unknown initializer entry type', () => {
  const provider = createDefaultSourceFactoryProvider();
  const ctx = makeSourceFactoryContext();
  const entry = { type: 'unknown' } as unknown as InitializerEntry;

  const factory = provider.createInitializerFactory(entry, ctx);

  expect(factory).toBeUndefined();
});

// --- createSynchronizerSlot ---

it('creates a PollingSynchronizer slot for a polling synchronizer entry', () => {
  const provider = createDefaultSourceFactoryProvider();
  const ctx = makeSourceFactoryContext();
  const entry: SynchronizerEntry = { type: 'polling' };

  const slot = provider.createSynchronizerSlot(entry, ctx);

  expect(slot).toBeDefined();
  expect(mockCreateSynchronizerSlot).toHaveBeenCalled();

  // Invoke the factory that was passed to createSynchronizerSlot
  const factoryArg = mockCreateSynchronizerSlot.mock.calls[0][0];
  const selectorGetter = () => 'sel';
  factoryArg.create(selectorGetter);
  expect(mockCreatePollingSynchronizer).toHaveBeenCalledWith(
    ctx.requestor,
    ctx.logger,
    selectorGetter,
    ctx.polling.intervalSeconds * 1000,
  );
});

it('creates a StreamingSynchronizer slot for a streaming synchronizer entry', () => {
  const provider = createDefaultSourceFactoryProvider();
  const ctx = makeSourceFactoryContext();
  const entry: SynchronizerEntry = { type: 'streaming' };

  const slot = provider.createSynchronizerSlot(entry, ctx);

  expect(slot).toBeDefined();
  expect(mockCreateSynchronizerSlot).toHaveBeenCalled();

  // Invoke the factory that was passed to createSynchronizerSlot
  const factoryArg = mockCreateSynchronizerSlot.mock.calls[0][0];
  const selectorGetter = () => 'sel';
  factoryArg.create(selectorGetter);
  expect(mockCreateStreamingBase).toHaveBeenCalledWith(
    expect.objectContaining({
      requests: ctx.requests,
      serviceEndpoints: ctx.serviceEndpoints,
      initialRetryDelayMillis: ctx.streaming.initialReconnectDelaySeconds * 1000,
    }),
  );
  expect(mockCreateStreamingSynchronizer).toHaveBeenCalledWith(
    mockCreateStreamingBase.mock.results[0].value,
  );
});

it('returns undefined for an unknown synchronizer entry type', () => {
  const provider = createDefaultSourceFactoryProvider();
  const ctx = makeSourceFactoryContext();
  const entry = { type: 'unknown' } as unknown as SynchronizerEntry;

  const slot = provider.createSynchronizerSlot(entry, ctx);

  expect(slot).toBeUndefined();
});

// --- per-entry overrides ---

it('creates a new requestor when polling entry has endpoint overrides', () => {
  const provider = createDefaultSourceFactoryProvider();
  const ctx = makeSourceFactoryContext();
  const entry: InitializerEntry = {
    type: 'polling',
    endpoints: { pollingBaseUri: 'https://custom-poll.example.com' },
  };

  const factory = provider.createInitializerFactory(entry, ctx);
  expect(factory).toBeDefined();

  const selectorGetter = () => undefined;
  factory!.create(selectorGetter);

  expect(mockMakeFDv2Requestor).toHaveBeenCalledWith(
    ctx.plainContextString,
    expect.objectContaining({
      polling: 'https://custom-poll.example.com',
      streaming: 'https://stream.example.com',
    }),
    ctx.polling.paths,
    ctx.requests,
    ctx.encoding,
    ctx.baseHeaders,
    ctx.queryParams,
  );

  // Should use the new requestor, not the context one
  const newRequestor = mockMakeFDv2Requestor.mock.results[0].value;
  expect(mockCreatePollingInitializer).toHaveBeenCalledWith(
    newRequestor,
    ctx.logger,
    selectorGetter,
  );
});

it('uses per-entry pollInterval override for polling synchronizer', () => {
  const provider = createDefaultSourceFactoryProvider();
  const ctx = makeSourceFactoryContext({ polling: { paths: makePaths(), intervalSeconds: 30 } });
  const entry: SynchronizerEntry = { type: 'polling', pollInterval: 60 };

  provider.createSynchronizerSlot(entry, ctx);

  const factoryArg = mockCreateSynchronizerSlot.mock.calls[0][0];
  const selectorGetter = () => undefined;
  factoryArg.create(selectorGetter);

  expect(mockCreatePollingSynchronizer).toHaveBeenCalledWith(
    ctx.requestor,
    ctx.logger,
    selectorGetter,
    60000,
  );
});

it('uses per-entry initialReconnectDelay override for streaming initializer', () => {
  const provider = createDefaultSourceFactoryProvider();
  const ctx = makeSourceFactoryContext({
    streaming: { paths: makePaths(), initialReconnectDelaySeconds: 1 },
  });
  const entry: InitializerEntry = { type: 'streaming', initialReconnectDelay: 5 };

  const factory = provider.createInitializerFactory(entry, ctx);
  expect(factory).toBeDefined();
  factory!.create(() => undefined);

  expect(mockCreateStreamingBase).toHaveBeenCalledWith(
    expect.objectContaining({
      initialRetryDelayMillis: 5000,
    }),
  );
});

// --- ping handler ---

it('ping handler uses the factory selector getter, not a stale reference', () => {
  const provider = createDefaultSourceFactoryProvider();
  const ctx = makeSourceFactoryContext();
  const entry: InitializerEntry = { type: 'streaming' };

  const factory = provider.createInitializerFactory(entry, ctx);
  expect(factory).toBeDefined();

  let currentSelector: string | undefined = 'selector-v1';
  const selectorGetter = () => currentSelector;
  factory!.create(selectorGetter);

  // Extract the pingHandler from the createStreamingBase call
  const streamingBaseArgs = mockCreateStreamingBase.mock.calls[0][0];
  const { pingHandler } = streamingBaseArgs;

  // Update the selector after factory creation
  currentSelector = 'selector-v2';
  pingHandler.handlePing();

  // The ping poll should use the fresh selector, not 'selector-v1'
  expect(mockFdv2Poll).toHaveBeenCalledWith(expect.anything(), 'selector-v2', ctx.logger);
});

it('ping handler uses per-entry endpoint-overridden requestor', () => {
  const provider = createDefaultSourceFactoryProvider();
  const ctx = makeSourceFactoryContext();
  const entry: InitializerEntry = {
    type: 'streaming',
    endpoints: { pollingBaseUri: 'https://custom-poll.example.com' },
  };

  const factory = provider.createInitializerFactory(entry, ctx);
  expect(factory).toBeDefined();
  factory!.create(() => undefined);

  // Extract the pingHandler from the createStreamingBase call
  const streamingBaseArgs = mockCreateStreamingBase.mock.calls[0][0];
  const { pingHandler } = streamingBaseArgs;
  pingHandler.handlePing();

  // The ping poll should use the overridden requestor, not ctx.requestor
  const overriddenRequestor = mockMakeFDv2Requestor.mock.results[0].value;
  expect(mockFdv2Poll).toHaveBeenCalledWith(overriddenRequestor, undefined, ctx.logger);
});
