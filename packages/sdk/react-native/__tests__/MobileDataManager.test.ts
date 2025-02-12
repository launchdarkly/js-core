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

import MobileDataManager from '../src/MobileDataManager';
import { ValidatedOptions } from '../src/options';
import PlatformCrypto from '../src/platform/crypto';
import PlatformEncoding from '../src/platform/PlatformEncoding';
import PlatformInfo from '../src/platform/PlatformInfo';
import PlatformStorage from '../src/platform/PlatformStorage';

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

describe('given a MobileDataManager with mocked dependencies', () => {
  let platform: jest.Mocked<Platform>;
  let flagManager: jest.Mocked<FlagManager>;
  let config: Configuration;
  let rnConfig: ValidatedOptions;
  let baseHeaders: LDHeaders;
  let emitter: jest.Mocked<LDEmitter>;
  let diagnosticsManager: jest.Mocked<internal.DiagnosticsManager>;
  let mobileDataManager: MobileDataManager;
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
    };
    const mockedFetch = mockFetch('{"flagA": true}', 200);
    platform = {
      crypto: new PlatformCrypto(),
      info: new PlatformInfo(config.logger),
      requests: {
        createEventSource: jest.fn((streamUri: string = '', options: any = {}) => ({
          streamUri,
          options,
          onclose: jest.fn(),
          addEventListener: jest.fn(),
          close: eventSourceCloseMethod,
        })),
        fetch: mockedFetch,
        getEventSourceCapabilities: jest.fn(),
      },
      storage: new PlatformStorage(config.logger),
      encoding: new PlatformEncoding(),
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

    rnConfig = { initialConnectionMode: 'streaming' } as ValidatedOptions;
    baseHeaders = {};
    emitter = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<LDEmitter>;
    diagnosticsManager = {} as unknown as jest.Mocked<internal.DiagnosticsManager>;

    mobileDataManager = new MobileDataManager(
      platform,
      flagManager,
      'test-credential',
      config,
      rnConfig,
      () => ({
        pathGet(encoding: Encoding, _plainContextString: string): string {
          return `/msdk/evalx/contexts/${base64UrlEncode(_plainContextString, encoding)}`;
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return `/msdk/evalx/context`;
        },
        pathPing(_encoding: Encoding, _plainContextString: string): string {
          // Note: if you are seeing this error, it is a coding error. This DataSourcePaths implementation is for polling endpoints. /ping is not currently
          // used in a polling situation. It is probably the case that this was called by streaming logic erroneously.
          throw new Error('Ping for polling unsupported.');
        },
      }),
      () => ({
        pathGet(encoding: Encoding, _plainContextString: string): string {
          return `/meval/${base64UrlEncode(_plainContextString, encoding)}`;
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return `/meval`;
        },
        pathPing(_encoding: Encoding, _plainContextString: string): string {
          return `/mping`;
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
    expect(mobileDataManager.getConnectionMode()).toBe('streaming');
  });

  it('should set and get connection mode', async () => {
    await mobileDataManager.setConnectionMode('polling');
    expect(mobileDataManager.getConnectionMode()).toBe('polling');

    await mobileDataManager.setConnectionMode('streaming');
    expect(mobileDataManager.getConnectionMode()).toBe('streaming');

    await mobileDataManager.setConnectionMode('offline');
    expect(mobileDataManager.getConnectionMode()).toBe('offline');
  });

  it('should log when connection mode remains the same', async () => {
    const initialMode = mobileDataManager.getConnectionMode();
    await mobileDataManager.setConnectionMode(initialMode);
    expect(logger.debug).toHaveBeenCalledWith(
      `[MobileDataManager] setConnectionMode ignored. Mode is already '${initialMode}'.`,
    );
    expect(mobileDataManager.getConnectionMode()).toBe(initialMode);
  });

  it('uses streaming when the connection mode is streaming', async () => {
    mobileDataManager.setConnectionMode('streaming');
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = { waitForNetworkResults: false };
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    await mobileDataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(platform.requests.createEventSource).toHaveBeenCalled();
    expect(platform.requests.fetch).not.toHaveBeenCalled();
  });

  it('uses polling when the connection mode is polling', async () => {
    mobileDataManager.setConnectionMode('polling');
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = { waitForNetworkResults: false };
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    await mobileDataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(platform.requests.createEventSource).not.toHaveBeenCalled();
    expect(platform.requests.fetch).toHaveBeenCalled();
  });

  it('makes no connection when offline', async () => {
    mobileDataManager.setConnectionMode('offline');
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = { waitForNetworkResults: false };
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    await mobileDataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(platform.requests.createEventSource).not.toHaveBeenCalled();
    expect(platform.requests.fetch).not.toHaveBeenCalled();
  });

  it('makes no connection when closed', async () => {
    mobileDataManager.close();

    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = { waitForNetworkResults: false };
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    await mobileDataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(platform.requests.createEventSource).not.toHaveBeenCalled();
    expect(platform.requests.fetch).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      '[MobileDataManager] Identify called after data manager was closed.',
    );
  });

  it('should load cached flags and resolve the identify', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = { waitForNetworkResults: false };
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    flagManager.loadCached.mockResolvedValue(true);

    await mobileDataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(logger.debug).toHaveBeenCalledWith(
      '[MobileDataManager] Identify completing with cached flags',
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

    await mobileDataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(logger.debug).toHaveBeenCalledWith(
      '[MobileDataManager] Identify - Flags loaded from cache, but identify was requested with "waitForNetworkResults"',
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

    await mobileDataManager.setConnectionMode('offline');
    flagManager.loadCached.mockResolvedValue(false);

    await mobileDataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(logger.debug).toHaveBeenCalledWith(
      '[MobileDataManager] Offline identify - no cached flags, using defaults or already loaded flags.',
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

    await mobileDataManager.setConnectionMode('offline');
    flagManager.loadCached.mockResolvedValue(true);

    await mobileDataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(logger.debug).toHaveBeenCalledWith(
      '[MobileDataManager] Offline identify - using cached flags.',
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

    await mobileDataManager.identify(identifyResolve, identifyReject, context, identifyOptions);
    expect(platform.requests.createEventSource).toHaveBeenCalled();

    mobileDataManager.close();
    expect(eventSourceCloseMethod).toHaveBeenCalled();

    // Verify a subsequent identify doesn't create a new event source
    await mobileDataManager.identify(identifyResolve, identifyReject, context, identifyOptions);
    expect(platform.requests.createEventSource).toHaveBeenCalledTimes(1);

    expect(logger.debug).toHaveBeenCalledWith(
      '[MobileDataManager] Identify called after data manager was closed.',
    );
  });
});
