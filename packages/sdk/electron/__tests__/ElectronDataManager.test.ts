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
import { ValidatedOptions } from '../src/options';
import ElectronCrypto from '../src/platform/ElectronCrypto';
import ElectronEncoding from '../src/platform/ElectronEncoding';
import ElectronInfo from '../src/platform/ElectronInfo';

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
});
