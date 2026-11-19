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
  LDIdentifyOptions,
  LDLogger,
  Platform,
  Response,
  ServiceEndpoints,
} from '@launchdarkly/js-client-sdk-common';

import ElectronDataManager from '../src/ElectronDataManager';
import type { ElectronIdentifyOptions } from '../src/ElectronIdentifyOptions';
import { ValidatedOptions } from '../src/options';
import ElectronCrypto from '../src/platform/ElectronCrypto';
import ElectronEncoding from '../src/platform/ElectronEncoding';
import ElectronInfo from '../src/platform/ElectronInfo';
import { goodBootstrapData } from './testBootstrapData';

function mockResponse(value: string, statusCode: number) {
  const response: Response = {
    headers: {
      get: jest.fn(),
      keys: jest.fn(),
      values: jest.fn(),
      entries: jest.fn(),
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
  f.mockResolvedValue(mockResponse(value, statusCode));
  return f;
}

beforeAll(() => {
  jest.useFakeTimers();
});

describe('given an ElectronDataManager with mocked dependencies', () => {
  let platform: jest.Mocked<Platform>;
  let flagManager: jest.Mocked<FlagManager>;
  let config: Configuration;
  let elConfig: ValidatedOptions;
  let baseHeaders: LDHeaders;
  let emitter: jest.Mocked<LDEmitter>;
  let diagnosticsManager: jest.Mocked<internal.DiagnosticsManager>;
  let dataManager: ElectronDataManager;
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
      usePost: false,
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
    const mockedFetch = mockFetch('{"flagA": true}', 200);
    platform = {
      crypto: new ElectronCrypto(),
      info: new ElectronInfo(),
      requests: {
        createEventSource: jest.fn((streamUri: string = '', options: any = {}) => ({
          streamUri,
          options,
          onclose: jest.fn(),
          addEventListener: jest.fn(),
          close: eventSourceCloseMethod,
        })),
        fetch: mockedFetch,
        getEventSourceCapabilities: jest.fn(() => ({
          customMethod: true,
        })),
      },
      storage: {
        clear: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
      },
      encoding: new ElectronEncoding(),
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

    elConfig = { initialConnectionMode: 'streaming' } as ValidatedOptions;
    baseHeaders = {};
    emitter = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<LDEmitter>;
    diagnosticsManager = {} as unknown as jest.Mocked<internal.DiagnosticsManager>;

    dataManager = new ElectronDataManager(
      platform,
      flagManager,
      'test-credential',
      config,
      elConfig,
      () => ({
        pathGet(encoding: Encoding, _plainContextString: string): string {
          return `/sdk/evalx/test-credential/contexts/${base64UrlEncode(_plainContextString, encoding)}`;
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return '/sdk/evalx/test-credential/context';
        },
        pathPost(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Post unsupported.');
        },
        pathPing(_encoding: Encoding, _plainContextString: string): string {
          // Note: if you are seeing this error, it is a coding error. This DataSourcePaths implementation is for polling endpoints. /ping is not currently
          // used in a polling situation. It is probably the case that this was called by streaming logic erroneously.
          throw new Error('Ping for polling unsupported.');
        },
      }),
      () => ({
        pathGet(encoding: Encoding, _plainContextString: string): string {
          return `/eval/test-credential/${base64UrlEncode(_plainContextString, encoding)}`;
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return '/eval/test-credential';
        },
        pathPost(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Post unsupported.');
        },
        pathPing(_encoding: Encoding, _plainContextString: string): string {
          return '/ping/test-credential';
        },
      }),
      baseHeaders,
      emitter,
      diagnosticsManager,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  function makeDataManagerWith(options: ValidatedOptions): ElectronDataManager {
    return new ElectronDataManager(
      platform,
      flagManager,
      'test-credential',
      config,
      options,
      () => ({
        pathGet(encoding: Encoding, _plainContextString: string): string {
          return `/sdk/evalx/test-credential/contexts/${base64UrlEncode(_plainContextString, encoding)}`;
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return '/sdk/evalx/test-credential/context';
        },
        pathPost(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Post unsupported.');
        },
        pathPing(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Ping for polling unsupported.');
        },
      }),
      () => ({
        pathGet(encoding: Encoding, _plainContextString: string): string {
          return `/eval/test-credential/${base64UrlEncode(_plainContextString, encoding)}`;
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return '/eval/test-credential';
        },
        pathPost(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Post unsupported.');
        },
        pathPing(_encoding: Encoding, _plainContextString: string): string {
          return '/ping/test-credential';
        },
      }),
      baseHeaders,
      emitter,
      diagnosticsManager,
    );
  }

  const clientSideOptions = (overrides: Partial<ValidatedOptions> = {}): ValidatedOptions => ({
    initialConnectionMode: 'streaming',
    plugins: [],
    enableIPC: false,
    useClientSideId: true,
    ...overrides,
  });

  it('includes the config hash in streaming requests', async () => {
    const manager = makeDataManagerWith(clientSideOptions({ hash: 'config-hash' }));
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await manager.identify(jest.fn(), jest.fn(), context, {});

    expect(platform.requests.createEventSource).toHaveBeenCalledWith(
      expect.stringContaining('h=config-hash'),
      expect.anything(),
    );
  });

  it('includes the config hash in polling requests', async () => {
    const manager = makeDataManagerWith(
      clientSideOptions({ initialConnectionMode: 'polling', hash: 'config-hash' }),
    );
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await new Promise<void>((resolve) => {
      manager.identify(jest.fn().mockImplementation(resolve), jest.fn(), context, {});
    });

    expect(platform.requests.fetch).toHaveBeenCalledWith(
      expect.stringContaining('h=config-hash'),
      expect.anything(),
    );
  });

  it('uses the per-identify hash instead of the config hash in streaming requests', async () => {
    const manager = makeDataManagerWith(clientSideOptions({ hash: 'config-hash' }));
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await manager.identify(jest.fn(), jest.fn(), context, {
      hash: 'per-identify-hash',
    } as ElectronIdentifyOptions);

    expect(platform.requests.createEventSource).toHaveBeenCalledWith(
      expect.stringContaining('h=per-identify-hash'),
      expect.anything(),
    );
  });

  it('uses the per-identify hash instead of the config hash in polling requests', async () => {
    const manager = makeDataManagerWith(
      clientSideOptions({ initialConnectionMode: 'polling', hash: 'config-hash' }),
    );
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await new Promise<void>((resolve) => {
      manager.identify(jest.fn().mockImplementation(resolve), jest.fn(), context, {
        hash: 'per-identify-hash',
      } as ElectronIdentifyOptions);
    });

    expect(platform.requests.fetch).toHaveBeenCalledWith(
      expect.stringContaining('h=per-identify-hash'),
      expect.anything(),
    );
  });

  it('omits the h parameter from streaming requests when no hash is configured', async () => {
    const manager = makeDataManagerWith(clientSideOptions());
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await manager.identify(jest.fn(), jest.fn(), context, {});

    const [streamUri] = (platform.requests.createEventSource as jest.Mock).mock.calls[0];
    expect(streamUri).not.toContain('h=');
  });

  it('omits the h parameter from polling requests when no hash is configured', async () => {
    const manager = makeDataManagerWith(clientSideOptions({ initialConnectionMode: 'polling' }));
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await new Promise<void>((resolve) => {
      manager.identify(jest.fn().mockImplementation(resolve), jest.fn(), context, {});
    });

    const [pollUri] = (platform.requests.fetch as jest.Mock).mock.calls[0];
    expect(pollUri).not.toContain('h=');
  });

  it('falls back to the config hash on a later identify without a per-identify hash', async () => {
    const manager = makeDataManagerWith(clientSideOptions({ hash: 'config-hash' }));
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await manager.identify(jest.fn(), jest.fn(), context, {
      hash: 'per-identify-hash',
    } as ElectronIdentifyOptions);
    await manager.identify(jest.fn(), jest.fn(), context, {});

    expect(platform.requests.createEventSource).toHaveBeenLastCalledWith(
      expect.stringContaining('h=config-hash'),
      expect.anything(),
    );
  });

  it('keeps the per-identify hash when the connection mode switches to polling', async () => {
    const manager = makeDataManagerWith(clientSideOptions({ hash: 'config-hash' }));
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await manager.identify(jest.fn(), jest.fn(), context, {
      hash: 'per-identify-hash',
    } as ElectronIdentifyOptions);
    await manager.setConnectionMode('polling');

    expect(platform.requests.fetch).toHaveBeenCalledWith(
      expect.stringContaining('h=per-identify-hash'),
      expect.anything(),
    );
  });

  it('warns and ignores the per-identify hash when the client uses a mobile key', async () => {
    const manager = makeDataManagerWith(
      clientSideOptions({ initialConnectionMode: 'polling', useClientSideId: false }),
    );
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await new Promise<void>((resolve) => {
      manager.identify(jest.fn().mockImplementation(resolve), jest.fn(), context, {
        hash: 'some-hash',
      } as ElectronIdentifyOptions);
    });

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('hash'));
    const [pollUri] = (platform.requests.fetch as jest.Mock).mock.calls[0];
    expect(pollUri).not.toContain('h=some-hash');
  });

  it('should initialize with the correct initial connection mode', () => {
    expect(dataManager.getConnectionMode()).toBe('streaming');
  });

  it('should set and get connection mode', async () => {
    await dataManager.setConnectionMode('polling');
    expect(dataManager.getConnectionMode()).toBe('polling');

    await dataManager.setConnectionMode('streaming');
    expect(dataManager.getConnectionMode()).toBe('streaming');

    await dataManager.setConnectionMode('offline');
    expect(dataManager.getConnectionMode()).toBe('offline');
  });

  it('uses data from bootstrap and then starts streaming for live updates', async () => {
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

    await dataManager.identify(identifyResolve, identifyReject, context, {
      bootstrap: goodBootstrapData,
    } as LDIdentifyOptions);

    expect(flagManager.setBootstrap).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        cat: expect.any(Object),
        killswitch: expect.any(Object),
      }),
    );
    expect(identifyResolve).toHaveBeenCalled();
    expect(identifyReject).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      '[ElectronDataManager] Identify - Initialization completed from bootstrap',
    );
    // After bootstrap we fall through and set up the connection for live updates
    expect(platform.requests.createEventSource).toHaveBeenCalled();
  });

  it('should log when connection mode remains the same', async () => {
    const initialMode = dataManager.getConnectionMode();
    await dataManager.setConnectionMode(initialMode);
    expect(logger.debug).toHaveBeenCalledWith(
      `[ElectronDataManager] setConnectionMode ignored. Mode is already '${initialMode}'.`,
    );
    expect(dataManager.getConnectionMode()).toBe(initialMode);
  });

  it('uses streaming when the connection mode is streaming', async () => {
    dataManager.setConnectionMode('streaming');
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = { waitForNetworkResults: false };
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    await dataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(platform.requests.createEventSource).toHaveBeenCalled();
    expect(platform.requests.fetch).not.toHaveBeenCalled();
  });

  it('uses polling when the connection mode is polling', async () => {
    dataManager.setConnectionMode('polling');
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = { waitForNetworkResults: false };
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    await dataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(platform.requests.createEventSource).not.toHaveBeenCalled();
    expect(platform.requests.fetch).toHaveBeenCalled();
  });

  it('makes no connection when offline', async () => {
    dataManager.setConnectionMode('offline');
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = { waitForNetworkResults: false };
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    await dataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(platform.requests.createEventSource).not.toHaveBeenCalled();
    expect(platform.requests.fetch).not.toHaveBeenCalled();
  });

  it('makes no connection when closed', async () => {
    dataManager.close();

    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = { waitForNetworkResults: false };
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    await dataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(platform.requests.createEventSource).not.toHaveBeenCalled();
    expect(platform.requests.fetch).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      '[ElectronDataManager] Identify called after data manager was closed.',
    );
  });

  it('should load cached flags and resolve the identify', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = { waitForNetworkResults: false };
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    flagManager.loadCached.mockResolvedValue(true);

    await dataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(logger.debug).toHaveBeenCalledWith(
      '[ElectronDataManager] Identify completing with cached flags',
    );

    expect(flagManager.loadCached).toHaveBeenCalledWith(context);
    expect(identifyResolve).toHaveBeenCalled();
  });

  it('should log that it loaded cached values, but is waiting for the network result', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = { waitForNetworkResults: true };
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    flagManager.loadCached.mockResolvedValue(true);

    await dataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(logger.debug).toHaveBeenCalledWith(
      '[ElectronDataManager] Identify - Flags loaded from cache, but identify was requested with "waitForNetworkResults"',
    );

    expect(flagManager.loadCached).toHaveBeenCalledWith(context);
    expect(identifyResolve).not.toHaveBeenCalled();
    expect(identifyReject).not.toHaveBeenCalled();
  });

  it('should handle offline identify without cache', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = {};
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    await dataManager.setConnectionMode('offline');
    flagManager.loadCached.mockResolvedValue(false);

    await dataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(logger.debug).toHaveBeenCalledWith(
      '[ElectronDataManager] Offline identify - no cached flags, using defaults or already loaded flags.',
    );

    expect(flagManager.loadCached).toHaveBeenCalledWith(context);
    expect(identifyResolve).toHaveBeenCalled();
    expect(identifyReject).not.toHaveBeenCalled();
  });

  it('should handle offline identify with cache', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = {};
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    await dataManager.setConnectionMode('offline');
    flagManager.loadCached.mockResolvedValue(true);

    await dataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(logger.debug).toHaveBeenCalledWith(
      '[ElectronDataManager] Offline identify - using cached flags.',
    );

    expect(flagManager.loadCached).toHaveBeenCalledWith(context);
    expect(identifyResolve).toHaveBeenCalled();
    expect(identifyReject).not.toHaveBeenCalled();
  });

  it('closes the event source when the data manager is closed', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = { waitForNetworkResults: false };
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    await dataManager.identify(identifyResolve, identifyReject, context, identifyOptions);
    expect(platform.requests.createEventSource).toHaveBeenCalled();

    dataManager.close();
    expect(eventSourceCloseMethod).toHaveBeenCalled();

    // Verify a subsequent identify doesn't create a new event source
    await dataManager.identify(identifyResolve, identifyReject, context, identifyOptions);
    expect(platform.requests.createEventSource).toHaveBeenCalledTimes(1);

    expect(logger.debug).toHaveBeenCalledWith(
      '[ElectronDataManager] Identify called after data manager was closed.',
    );
  });

  it('uses REPORT method and includes context in body when useReport is true', async () => {
    const useReportConfig = { ...config, useReport: true };
    dataManager = new ElectronDataManager(
      platform,
      flagManager,
      'test-credential',
      useReportConfig,
      elConfig,
      () => ({
        pathGet(encoding: Encoding, _plainContextString: string): string {
          return `/sdk/evalx/test-credential/contexts/${base64UrlEncode(_plainContextString, encoding)}`;
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return '/sdk/evalx/test-credential/context';
        },
        pathPost(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Post unsupported.');
        },
        pathPing(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Ping for polling unsupported.');
        },
      }),
      () => ({
        pathGet(encoding: Encoding, _plainContextString: string): string {
          return `/eval/test-credential/${base64UrlEncode(_plainContextString, encoding)}`;
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return '/eval/test-credential';
        },
        pathPost(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Post unsupported.');
        },
        pathPing(_encoding: Encoding, _plainContextString: string): string {
          return '/ping/test-credential';
        },
      }),
      baseHeaders,
      emitter,
      diagnosticsManager,
    );

    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = { waitForNetworkResults: false };
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    await dataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(platform.requests.createEventSource).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: 'REPORT',
        body: JSON.stringify(Context.toLDContext(context)),
        headers: expect.objectContaining({
          'content-type': 'application/json',
        }),
      }),
    );
  });

  it('includes withReasons query parameter when withReasons is true', async () => {
    const withReasonsConfig = { ...config, withReasons: true };
    dataManager = new ElectronDataManager(
      platform,
      flagManager,
      'test-credential',
      withReasonsConfig,
      elConfig,
      () => ({
        pathGet(encoding: Encoding, _plainContextString: string): string {
          return `/sdk/evalx/test-credential/contexts/${base64UrlEncode(_plainContextString, encoding)}`;
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return '/sdk/evalx/test-credential/context';
        },
        pathPost(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Post unsupported.');
        },
        pathPing(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Ping for polling unsupported.');
        },
      }),
      () => ({
        pathGet(encoding: Encoding, _plainContextString: string): string {
          return `/eval/test-credential/${base64UrlEncode(_plainContextString, encoding)}`;
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return '/eval/test-credential';
        },
        pathPost(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Post unsupported.');
        },
        pathPing(_encoding: Encoding, _plainContextString: string): string {
          return '/ping/test-credential';
        },
      }),
      baseHeaders,
      emitter,
      diagnosticsManager,
    );

    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = { waitForNetworkResults: false };
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    await dataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(platform.requests.createEventSource).toHaveBeenCalledWith(
      expect.stringContaining('?withReasons=true'),
      expect.anything(),
    );
  });

  it('uses GET method and does not include context in body when useReport is false', async () => {
    const useReportConfig = { ...config, useReport: false };
    dataManager = new ElectronDataManager(
      platform,
      flagManager,
      'test-credential',
      useReportConfig,
      elConfig,
      () => ({
        pathGet(encoding: Encoding, _plainContextString: string): string {
          return `/sdk/evalx/test-credential/contexts/${base64UrlEncode(_plainContextString, encoding)}`;
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return '/sdk/evalx/test-credential/context';
        },
        pathPost(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Post unsupported.');
        },
        pathPing(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Ping for polling unsupported.');
        },
      }),
      () => ({
        pathGet(encoding: Encoding, _plainContextString: string): string {
          return `/eval/test-credential/${base64UrlEncode(_plainContextString, encoding)}`;
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return '/eval/test-credential';
        },
        pathPost(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Post unsupported.');
        },
        pathPing(_encoding: Encoding, _plainContextString: string): string {
          return '/ping/test-credential';
        },
      }),
      baseHeaders,
      emitter,
      diagnosticsManager,
    );

    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = { waitForNetworkResults: false };
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    await dataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(platform.requests.createEventSource).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.not.objectContaining({
          'content-type': 'application/json',
        }),
      }),
    );
    expect((platform.requests.createEventSource as jest.Mock).mock.calls[0][1].method).not.toBe(
      'REPORT',
    );
  });

  it('does not include withReasons query parameter when withReasons is false', async () => {
    const withReasonsConfig = { ...config, withReasons: false };
    dataManager = new ElectronDataManager(
      platform,
      flagManager,
      'test-credential',
      withReasonsConfig,
      elConfig,
      () => ({
        pathGet(encoding: Encoding, _plainContextString: string): string {
          return `/sdk/evalx/test-credential/contexts/${base64UrlEncode(_plainContextString, encoding)}`;
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return '/sdk/evalx/test-credential/context';
        },
        pathPost(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Post unsupported.');
        },
        pathPing(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Ping for polling unsupported.');
        },
      }),
      () => ({
        pathGet(encoding: Encoding, _plainContextString: string): string {
          return `/eval/test-credential/${base64UrlEncode(_plainContextString, encoding)}`;
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return '/eval/test-credential';
        },
        pathPost(_encoding: Encoding, _plainContextString: string): string {
          throw new Error('Post unsupported.');
        },
        pathPing(_encoding: Encoding, _plainContextString: string): string {
          return '/ping/test-credential';
        },
      }),
      baseHeaders,
      emitter,
      diagnosticsManager,
    );

    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = { waitForNetworkResults: false };
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    await dataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(platform.requests.createEventSource).toHaveBeenCalledWith(
      expect.not.stringContaining('withReasons=true'),
      expect.anything(),
    );
  });

  it('pauses the connection and keeps the mode when the network becomes unavailable', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    await dataManager.identify(jest.fn(), jest.fn(), context, {});
    expect(platform.requests.createEventSource).toHaveBeenCalledTimes(1);

    dataManager.setNetworkAvailability(false);

    expect(eventSourceCloseMethod).toHaveBeenCalledTimes(1);
    expect(dataManager.getConnectionMode()).toBe('streaming');
  });

  it('resumes the connection in the current mode when the network returns', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    await dataManager.identify(jest.fn(), jest.fn(), context, {});

    dataManager.setNetworkAvailability(false);
    dataManager.setNetworkAvailability(true);

    expect(platform.requests.createEventSource).toHaveBeenCalledTimes(2);
    expect(platform.requests.fetch).not.toHaveBeenCalled();
  });

  it('does not open a connection and resolves the identify while the network is unavailable', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();
    dataManager.setNetworkAvailability(false);

    await dataManager.identify(identifyResolve, identifyReject, context, {});

    expect(platform.requests.createEventSource).not.toHaveBeenCalled();
    expect(platform.requests.fetch).not.toHaveBeenCalled();
    expect(identifyResolve).toHaveBeenCalled();
    expect(identifyReject).not.toHaveBeenCalled();
  });

  it('opens the deferred connection when the network returns after an identify', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    dataManager.setNetworkAvailability(false);
    await dataManager.identify(jest.fn(), jest.fn(), context, {});

    dataManager.setNetworkAvailability(true);

    expect(platform.requests.createEventSource).toHaveBeenCalledTimes(1);
  });

  it('does not open a connection when the network returns while offline', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    await dataManager.setConnectionMode('offline');
    await dataManager.identify(jest.fn(), jest.fn(), context, {});

    dataManager.setNetworkAvailability(false);
    dataManager.setNetworkAvailability(true);

    expect(platform.requests.createEventSource).not.toHaveBeenCalled();
    expect(platform.requests.fetch).not.toHaveBeenCalled();
  });

  it('defers a mode change made while the network is unavailable until the network returns', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    await dataManager.identify(jest.fn(), jest.fn(), context, {});
    dataManager.setNetworkAvailability(false);

    await dataManager.setConnectionMode('polling');
    expect(platform.requests.fetch).not.toHaveBeenCalled();

    dataManager.setNetworkAvailability(true);
    expect(platform.requests.fetch).toHaveBeenCalledTimes(1);
    expect(dataManager.getConnectionMode()).toBe('polling');
  });

  it('ignores a repeated network availability value', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    await dataManager.identify(jest.fn(), jest.fn(), context, {});

    dataManager.setNetworkAvailability(true);

    expect(eventSourceCloseMethod).not.toHaveBeenCalled();
    expect(platform.requests.createEventSource).toHaveBeenCalledTimes(1);
  });

  it('keeps the hash on the connection that resumes after a network pause', async () => {
    const manager = makeDataManagerWith(clientSideOptions({ hash: 'config-hash' }));
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    await manager.identify(jest.fn(), jest.fn(), context, {});

    manager.setNetworkAvailability(false);
    manager.setNetworkAvailability(true);

    expect(platform.requests.createEventSource).toHaveBeenCalledTimes(2);
    expect(platform.requests.createEventSource).toHaveBeenLastCalledWith(
      expect.stringContaining('h=config-hash'),
      expect.anything(),
    );
  });

  it('does not resume the connection when the network returns after the data manager closed', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    await dataManager.identify(jest.fn(), jest.fn(), context, {});
    dataManager.setNetworkAvailability(false);

    dataManager.close();
    dataManager.setNetworkAvailability(true);

    expect(platform.requests.createEventSource).toHaveBeenCalledTimes(1);
  });

  it('reports the data source as closed on pause and initializing on resume', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    await dataManager.identify(jest.fn(), jest.fn(), context, {});
    emitter.emit.mockClear();

    dataManager.setNetworkAvailability(false);
    expect(emitter.emit).toHaveBeenCalledWith(
      'dataSourceStatus',
      expect.objectContaining({ state: 'CLOSED' }),
    );

    dataManager.setNetworkAvailability(true);
    expect(emitter.emit).toHaveBeenCalledWith(
      'dataSourceStatus',
      expect.objectContaining({ state: 'INITIALIZING' }),
    );
  });

  async function deliverPutOnLatestStream() {
    diagnosticsManager.recordStreamInit = jest.fn();
    const sources = (platform.requests.createEventSource as jest.Mock).mock.results;
    const source = sources[sources.length - 1].value;
    const putCall = source.addEventListener.mock.calls.find(([name]: [string]) => name === 'put');
    putCall[1]({ data: '{}' });
    await jest.advanceTimersByTimeAsync(0);
  }

  it('resolves a pending identify when the network pauses before the first put', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();
    await dataManager.identify(identifyResolve, identifyReject, context, {});
    expect(identifyResolve).not.toHaveBeenCalled();

    dataManager.setNetworkAvailability(false);

    expect(identifyResolve).toHaveBeenCalledTimes(1);
    expect(identifyReject).not.toHaveBeenCalled();
  });

  it('resolves a second identify on its put after a pause and resume', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    await dataManager.identify(jest.fn(), jest.fn(), context, {});
    dataManager.setNetworkAvailability(false);
    dataManager.setNetworkAvailability(true);
    const identifyResolve = jest.fn();

    await dataManager.identify(identifyResolve, jest.fn(), context, {});
    await deliverPutOnLatestStream();

    expect(identifyResolve).toHaveBeenCalledTimes(1);
  });

  it('keeps a pending identify alive across a mode switch until the put arrives', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyResolve = jest.fn();
    await dataManager.identify(identifyResolve, jest.fn(), context, {});
    dataManager.setConnectionMode('polling');
    dataManager.setConnectionMode('streaming');
    expect(identifyResolve).not.toHaveBeenCalled();

    await deliverPutOnLatestStream();

    expect(identifyResolve).toHaveBeenCalledTimes(1);
  });

  it('resolves a pending identify when the connection mode changes to offline', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyResolve = jest.fn();
    await dataManager.identify(identifyResolve, jest.fn(), context, {});

    await dataManager.setConnectionMode('offline');

    expect(identifyResolve).toHaveBeenCalledTimes(1);
  });

  it('ignores an unknown connection mode when the network returns', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    await dataManager.identify(jest.fn(), jest.fn(), context, {});
    dataManager.setNetworkAvailability(false);

    await dataManager.setConnectionMode('bogus' as any);

    expect(() => dataManager.setNetworkAvailability(true)).not.toThrow();

    expect(dataManager.getConnectionMode()).toBe('streaming');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Unknown ConnectionMode'));
  });

  it('resolves once when the mode goes offline during the cache load of a waiting identify', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    let finishLoad: (loaded: boolean) => void = () => {};
    flagManager.loadCached.mockReturnValue(new Promise((r) => (finishLoad = r)));
    const identifyResolve = jest.fn();

    const identifying = dataManager.identify(identifyResolve, jest.fn(), context, {
      waitForNetworkResults: true,
    });
    await dataManager.setConnectionMode('offline');
    finishLoad(true);
    await identifying;

    expect(identifyResolve).toHaveBeenCalledTimes(1);
  });

  it('resolves a pending identify when the data manager closes', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyResolve = jest.fn();
    await dataManager.identify(identifyResolve, jest.fn(), context, {});

    dataManager.close();

    expect(identifyResolve).toHaveBeenCalledTimes(1);
  });

  it('resolves an identify that starts after the data manager closed', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyResolve = jest.fn();
    dataManager.close();

    await dataManager.identify(identifyResolve, jest.fn(), context, {});

    expect(identifyResolve).toHaveBeenCalledTimes(1);
  });

  it('resolves an identify when the data manager closes during the cache load', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    let finishLoad: (loaded: boolean) => void = () => {};
    flagManager.loadCached.mockReturnValue(new Promise((r) => (finishLoad = r)));
    const identifyResolve = jest.fn();

    const identifying = dataManager.identify(identifyResolve, jest.fn(), context, {});
    dataManager.close();
    finishLoad(false);
    await identifying;

    expect(identifyResolve).toHaveBeenCalledTimes(1);
  });

  it('opens no stream when the data manager closes during the cache load', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    let finishLoad: (loaded: boolean) => void = () => {};
    flagManager.loadCached.mockReturnValue(new Promise((r) => (finishLoad = r)));

    const identifying = dataManager.identify(jest.fn(), jest.fn(), context, {});
    dataManager.close();
    finishLoad(false);
    await identifying;

    expect(platform.requests.createEventSource).not.toHaveBeenCalled();
    expect(platform.requests.fetch).not.toHaveBeenCalled();
  });
});
