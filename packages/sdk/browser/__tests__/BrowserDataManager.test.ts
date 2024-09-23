import {
  ApplicationTags,
  Configuration,
  Context,
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

import BrowserDataManager from '../src/BrowserDataManager';
import { ValidatedOptions } from '../src/options';

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

describe('given a BrowserDataManager with mocked dependencies', () => {
  let platform: jest.Mocked<Platform>;
  let flagManager: jest.Mocked<FlagManager>;
  let config: Configuration;
  let browserConfig: ValidatedOptions;
  let baseHeaders: LDHeaders;
  let emitter: jest.Mocked<LDEmitter>;
  let diagnosticsManager: jest.Mocked<internal.DiagnosticsManager>;
  let browserDataManager: BrowserDataManager;
  let logger: LDLogger;

  beforeEach(() => {
    logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    config = {
      logger,
      baseUri: 'string',
      eventsUri: 'string',
      streamUri: 'string',
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
    }
    const mockedFetch = mockFetch('{"flagA": true}', 200);
    platform = {
      requests: {
        fetch: mockedFetch,
        createEventSource: jest.fn(),
        getEventSourceCapabilities: jest.fn(),
      },
    } as unknown as jest.Mocked<Platform>;

    flagManager = {
      loadCached: jest.fn(),
    } as unknown as jest.Mocked<FlagManager>;

    browserConfig = { stream: true } as ValidatedOptions;
    baseHeaders = {};
    emitter = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<LDEmitter>;
    diagnosticsManager = {} as unknown as jest.Mocked<internal.DiagnosticsManager>;

    browserDataManager = new BrowserDataManager(
      platform,
      flagManager,
      'test-credential',
      config,
      browserConfig,
      () => ({
        pathGet: jest.fn(),
        pathReport: jest.fn(),
      }),
      () => ({
        pathGet: jest.fn(),
        pathReport: jest.fn(),
      }),
      baseHeaders,
      emitter,
      diagnosticsManager,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should load cached flags and continue to initialize via a poll', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = {};
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    flagManager.loadCached.mockResolvedValue(true);

    await browserDataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(logger.debug).toHaveBeenCalledWith(
      'Identify - Flags loaded from cache. Continuing to initialize via a poll.',
    );
    expect(flagManager.loadCached).toHaveBeenCalledWith(context);
    expect(platform.requests.fetch).toHaveBeenCalled();
  });

  it('should set up streaming connection if stream is enabled', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = {};
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    await browserDataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(platform.requests.createEventSource).toHaveBeenCalled();
  });

  it('should not set up streaming connection if stream is disabled', async () => {
    browserConfig.stream = false;
    const context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
    const identifyOptions: LDIdentifyOptions = {};
    const identifyResolve = jest.fn();
    const identifyReject = jest.fn();

    await browserDataManager.identify(identifyResolve, identifyReject, context, identifyOptions);

    expect(platform.requests.createEventSource).not.toHaveBeenCalled();
  });

  // it('should stop the data source', () => {
  //   const mockClose = jest.fn();
  //   browserDataManager.updateProcessor = { close: mockClose } as any;

  //   browserDataManager.stopDataSource();

  //   expect(mockClose).toHaveBeenCalled();
  //   expect(browserDataManager.updateProcessor).toBeUndefined();
  // });

  // it('should start the data source if context exists', () => {
  //   const mockSetupConnection = jest.spyOn(browserDataManager as any, 'setupConnection');
  //   browserDataManager.context = Context.fromLDContext({ kind: 'user', key: 'test-user' });

  //   browserDataManager.startDataSource();

  //   expect(mockSetupConnection).toHaveBeenCalled();
  // });

  // it('should not start the data source if context does not exist', () => {
  //   const mockSetupConnection = jest.spyOn(browserDataManager as any, 'setupConnection');
  //   browserDataManager.context = undefined;

  //   browserDataManager.startDataSource();

  //   expect(mockSetupConnection).not.toHaveBeenCalled();
  // });
});
