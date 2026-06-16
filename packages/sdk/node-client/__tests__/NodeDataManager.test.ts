import {
  ApplicationTags,
  base64UrlEncode,
  Configuration,
  Context,
  Encoding,
  FlagManager,
  internal,
  LDEmitter,
  LDHeaders,
  LDLogger,
  Platform,
  Response,
  ServiceEndpoints,
} from '@launchdarkly/js-client-sdk-common';

import NodeDataManager from '../src/NodeDataManager';
import type { NodeIdentifyOptions } from '../src/NodeIdentifyOptions';
import { ValidatedOptions } from '../src/options';
import NodeCrypto from '../src/platform/NodeCrypto';
import NodeEncoding from '../src/platform/NodeEncoding';
import NodeInfo from '../src/platform/NodeInfo';

function mockResponse(value: string, statusCode: number) {
  const response: Response = {
    headers: {
      // @ts-ignore
      get: jest.fn(),
      // @ts-ignore
      keys: jest.fn(),
      // @ts-ignore
      values: jest.fn(),
      // @ts-ignore
      entries: jest.fn(),
      // @ts-ignore
      has: jest.fn(),
    },
    status: statusCode,
    text: () => Promise.resolve(value),
    json: () => Promise.resolve(JSON.parse(value)),
  };
  return Promise.resolve(response);
}

function mockFetch(value: string, statusCode: number = 200) {
  const f = jest.fn();
  // @ts-ignore
  f.mockResolvedValue(mockResponse(value, statusCode));
  return f;
}

function makeNodeConfig(overrides: Partial<ValidatedOptions> = {}): ValidatedOptions {
  return {
    initialConnectionMode: 'streaming',
    plugins: [],
    ...overrides,
  };
}

beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

describe('given a NodeDataManager with mocked dependencies', () => {
  let platform: jest.Mocked<Platform>;
  let flagManager: jest.Mocked<FlagManager>;
  let config: Configuration;
  let baseHeaders: LDHeaders;
  let emitter: jest.Mocked<LDEmitter>;
  let diagnosticsManager: jest.Mocked<internal.DiagnosticsManager>;
  let logger: LDLogger;
  let eventSourceCloseMethod: jest.Mock;

  beforeEach(() => {
    logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    eventSourceCloseMethod = jest.fn();

    config = {
      logger,
      maxCachedContexts: 5,
      capacity: 100,
      diagnosticRecordingInterval: 1000,
      flushInterval: 1000,
      streamInitialReconnectDelay: 1000,
      allAttributesPrivate: false,
      debug: true,
      diagnosticOptOut: false,
      sendEvents: false,
      sendLDHeaders: true,
      useReport: false,
      withReasons: true,
      privateAttributes: [],
      tags: new ApplicationTags({}),
      serviceEndpoints: new ServiceEndpoints('', ''),
      pollInterval: 1000,
      userAgentHeaderName: 'user-agent',
      trackEventModifier: (event) => event,
      hooks: [],
      inspectors: [],
      getImplementationHooks: () => [],
      credentialType: 'clientSideId',
    };

    platform = {
      crypto: new NodeCrypto(),
      info: new NodeInfo(),
      requests: {
        createEventSource: jest.fn((streamUri: string = '', options: any = {}) => ({
          streamUri,
          options,
          onclose: jest.fn(),
          addEventListener: jest.fn(),
          close: eventSourceCloseMethod,
        })),
        fetch: mockFetch('{"flagA": true}', 200),
        getEventSourceCapabilities: jest.fn(() => ({})),
      },
      storage: {
        clear: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
      },
      encoding: new NodeEncoding(),
    } as unknown as jest.Mocked<Platform>;

    flagManager = {
      loadCached: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(),
      init: jest.fn(),
      upsert: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      setBootstrap: jest.fn(),
    } as unknown as jest.Mocked<FlagManager>;

    baseHeaders = {};
    emitter = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<LDEmitter>;
    diagnosticsManager = {} as unknown as jest.Mocked<internal.DiagnosticsManager>;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  function makeDataManager(nodeConfig: ValidatedOptions) {
    return new NodeDataManager(
      platform,
      flagManager,
      'test-credential',
      config,
      nodeConfig,
      () => ({
        pathGet(encoding: Encoding, plainContextString: string): string {
          return `/poll/${base64UrlEncode(plainContextString, encoding)}`;
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return '/poll/context';
        },
        pathPost(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Post unsupported.');
        },
        pathPing(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Ping for polling unsupported.');
        },
      }),
      () => ({
        pathGet(encoding: Encoding, plainContextString: string): string {
          return `/stream/${base64UrlEncode(plainContextString, encoding)}`;
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return '/stream/context';
        },
        pathPost(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Post unsupported.');
        },
        pathPing(_encoding: Encoding, _plainContextString: string): string {
          return '/ping';
        },
      }),
      baseHeaders,
      emitter,
      diagnosticsManager,
    );
  }

  it('includes the config-level hash in streaming requests', async () => {
    const dataManager = makeDataManager(makeNodeConfig({ hash: 'config-hash' }));
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await dataManager.identify(jest.fn(), jest.fn(), context, {});

    expect(platform.requests.createEventSource).toHaveBeenCalledWith(
      expect.stringContaining('h=config-hash'),
      expect.anything(),
    );
  });

  it('includes the config-level hash in polling requests', async () => {
    const dataManager = makeDataManager(
      makeNodeConfig({ initialConnectionMode: 'polling', hash: 'config-hash' }),
    );
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await new Promise<void>((resolve) => {
      const identifyResolve = jest.fn().mockImplementation(resolve);
      dataManager.identify(identifyResolve, jest.fn(), context, {});
    });

    expect(platform.requests.fetch).toHaveBeenCalledWith(
      expect.stringContaining('h=config-hash'),
      expect.anything(),
    );
  });

  it('per-identify hash overrides config hash in streaming requests', async () => {
    const dataManager = makeDataManager(makeNodeConfig({ hash: 'config-hash' }));
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await dataManager.identify(jest.fn(), jest.fn(), context, {
      hash: 'per-identify-hash',
    } as NodeIdentifyOptions);

    expect(platform.requests.createEventSource).toHaveBeenCalledWith(
      expect.stringContaining('h=per-identify-hash'),
      expect.anything(),
    );
  });

  it('per-identify hash overrides config hash in polling requests', async () => {
    const dataManager = makeDataManager(
      makeNodeConfig({ initialConnectionMode: 'polling', hash: 'config-hash' }),
    );
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await new Promise<void>((resolve) => {
      const identifyResolve = jest.fn().mockImplementation(resolve);
      dataManager.identify(identifyResolve, jest.fn(), context, {
        hash: 'per-identify-hash',
      } as NodeIdentifyOptions);
    });

    expect(platform.requests.fetch).toHaveBeenCalledWith(
      expect.stringContaining('h=per-identify-hash'),
      expect.anything(),
    );
  });

  it('uses per-identify hash when no config hash is set in streaming requests', async () => {
    const dataManager = makeDataManager(makeNodeConfig());
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await dataManager.identify(jest.fn(), jest.fn(), context, {
      hash: 'identify-only-hash',
    } as NodeIdentifyOptions);

    expect(platform.requests.createEventSource).toHaveBeenCalledWith(
      expect.stringContaining('h=identify-only-hash'),
      expect.anything(),
    );
  });

  it('does not include the h param in streaming requests when no hash is configured', async () => {
    const dataManager = makeDataManager(makeNodeConfig());
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await dataManager.identify(jest.fn(), jest.fn(), context, {});

    const [streamUri] = (platform.requests.createEventSource as jest.Mock).mock.calls[0];
    expect(streamUri).not.toContain('h=');
  });

  it('does not include the h param in polling requests when no hash is configured', async () => {
    const dataManager = makeDataManager(makeNodeConfig({ initialConnectionMode: 'polling' }));
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await new Promise<void>((resolve) => {
      const identifyResolve = jest.fn().mockImplementation(resolve);
      dataManager.identify(identifyResolve, jest.fn(), context, {});
    });

    const [pollUri] = (platform.requests.fetch as jest.Mock).mock.calls[0];
    expect(pollUri).not.toContain('h=');
  });

  it('falls back to config hash on second identify when per-identify hash is omitted', async () => {
    const dataManager = makeDataManager(makeNodeConfig({ hash: 'config-hash' }));
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const context2 = Context.fromLDContext({ kind: 'user', key: 'test-user-2' });

    await dataManager.identify(jest.fn(), jest.fn(), context, {
      hash: 'per-identify-hash',
    } as NodeIdentifyOptions);
    (platform.requests.createEventSource as jest.Mock).mockClear();

    await dataManager.identify(jest.fn(), jest.fn(), context2, {});

    expect(platform.requests.createEventSource).toHaveBeenCalledWith(
      expect.stringContaining('h=config-hash'),
      expect.anything(),
    );
  });

  it('omits h param on second identify when per-identify hash is omitted and no config hash is set', async () => {
    const dataManager = makeDataManager(makeNodeConfig());
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const context2 = Context.fromLDContext({ kind: 'user', key: 'test-user-2' });

    await dataManager.identify(jest.fn(), jest.fn(), context, {
      hash: 'per-identify-hash',
    } as NodeIdentifyOptions);
    (platform.requests.createEventSource as jest.Mock).mockClear();

    await dataManager.identify(jest.fn(), jest.fn(), context2, {});

    const [streamUri] = (platform.requests.createEventSource as jest.Mock).mock.calls[0];
    expect(streamUri).not.toContain('h=');
  });

  it('per-identify hash persists when connection mode switches to polling', async () => {
    const dataManager = makeDataManager(makeNodeConfig({ hash: 'config-hash' }));
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await dataManager.identify(jest.fn(), jest.fn(), context, {
      hash: 'per-identify-hash',
    } as NodeIdentifyOptions);

    await dataManager.setConnectionMode('polling');

    expect(platform.requests.fetch).toHaveBeenCalledWith(
      expect.stringContaining('h=per-identify-hash'),
      expect.anything(),
    );
  });

  it('includes the per-identify hash in the connection opened after bootstrap', async () => {
    const dataManager = makeDataManager(makeNodeConfig());
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await dataManager.identify(jest.fn(), jest.fn(), context, {
      hash: 'per-identify-hash',
      bootstrap: {},
    } as NodeIdentifyOptions);

    expect(platform.requests.createEventSource).toHaveBeenCalledWith(
      expect.stringContaining('h=per-identify-hash'),
      expect.anything(),
    );
  });
});
