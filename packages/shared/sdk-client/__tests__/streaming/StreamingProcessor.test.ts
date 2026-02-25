import {
  DataSourceErrorKind,
  defaultHeaders,
  Encoding,
  EventName,
  Info,
  internal,
  LDHeaders,
  LDLogger,
  LDStreamingError,
  Platform,
  ProcessStreamResponse,
  Requests,
  ServiceEndpoints,
} from '@launchdarkly/js-sdk-common';

import { makeRequestor, Requestor } from '../../src/datasource/Requestor';
import {
  DataSourcePaths,
  StreamingDataSourceConfig,
  StreamingProcessor,
} from '../../src/streaming';
import { createBasicPlatform } from '../createBasicPlatform';

let logger: LDLogger;

const serviceEndpoints = {
  events: '',
  polling: '',
  streaming: 'https://mockstream.ld.com',
  diagnosticEventPath: '/diagnostic',
  analyticsEventPath: '/bulk',
  includeAuthorizationHeader: true,
  payloadFilterKey: 'testPayloadFilterKey',
};

const dateNowString = '2023-08-10';
const sdkKey = 'my-sdk-key';

const flagData = {
  flags: {
    flagkey: { key: 'flagkey', version: 1 },
  },
  segments: {
    segkey: { key: 'segkey', version: 2 },
  },
};
const event = {
  data: flagData,
};

let basicPlatform: Platform;

function getStreamingDataSourceConfig(
  withReasons: boolean = false,
  useReport: boolean = false,
  queryParameters?: [{ key: string; value: string }],
): StreamingDataSourceConfig {
  return {
    credential: sdkKey,
    // eslint-disable-next-line object-shorthand
    serviceEndpoints: serviceEndpoints,
    paths: {
      pathGet(_encoding: Encoding, _plainContextString: string): string {
        return '/stream/path/get';
      },
      pathReport(_encoding: Encoding, _plainContextString: string): string {
        return '/stream/path/report';
      },
      pathPost(_encoding: Encoding, _plainContextString: string): string {
        throw new Error('Post unsupported.');
      },
      pathPing(_encoding: Encoding, _plainContextString: string): string {
        return '/stream/path/ping';
      },
    },
    baseHeaders: {
      authorization: 'my-sdk-key',
      'user-agent': 'TestUserAgent/2.0.2',
      'x-launchdarkly-wrapper': 'Rapper/1.2.3',
    },
    initialRetryDelayMillis: 1000,
    withReasons,
    useReport,
    queryParameters,
  };
}

beforeEach(() => {
  basicPlatform = createBasicPlatform();
  logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
});

const createMockEventSource = (streamUri: string = '', options: any = {}) => ({
  streamUri,
  options,
  onclose: jest.fn(),
  addEventListener: jest.fn(),
  close: jest.fn(),
});

function makeTestRequestor(options: {
  requests: Requests;
  plainContextString?: string;
  serviceEndpoints?: ServiceEndpoints;
  paths?: DataSourcePaths;
  encoding?: Encoding;
  baseHeaders?: LDHeaders;
  baseQueryParams?: { key: string; value: string }[];
  useReport?: boolean;
  withReasons?: boolean;
  secureModeHash?: string;
}): Requestor {
  return makeRequestor(
    options.plainContextString ?? 'mockContextString',
    options.serviceEndpoints ?? serviceEndpoints,
    options.paths ?? {
      pathGet(_encoding: Encoding, _plainContextString: string): string {
        return '/polling/path/get';
      },
      pathReport(_encoding: Encoding, _plainContextString: string): string {
        return '/polling/path/report';
      },
      pathPost(_encoding: Encoding, _plainContextString: string): string {
        throw new Error('Post unsupported.');
      },
      pathPing(_encoding: Encoding, _plainContextString: string): string {
        return '/polling/path/ping';
      },
    },
    options.requests,
    options.encoding ?? {
      btoa: jest.fn(),
    },
    options.baseHeaders,
    options.baseQueryParams,
    options.withReasons ?? true,
    options.useReport ?? false,
  );
}

describe('given a stream processor', () => {
  let info: Info;
  let streamingProcessor: StreamingProcessor;
  let diagnosticsManager: internal.DiagnosticsManager;
  let listeners: Map<EventName, ProcessStreamResponse>;
  let mockEventSource: any;
  let mockListener: ProcessStreamResponse;
  let mockErrorHandler: jest.Mock;
  let simulatePutEvent: (e?: any) => void;
  let simulatePingEvent: () => void;
  let simulateError: (e: { status: number; message: string }) => boolean;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(dateNowString));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    mockErrorHandler = jest.fn();

    info = basicPlatform.info;

    basicPlatform.requests = {
      createEventSource: jest.fn((streamUri: string, options: any) => {
        mockEventSource = createMockEventSource(streamUri, options);
        return mockEventSource;
      }),
      getEventSourceCapabilities: jest.fn(() => ({
        readTimeout: true,
        headers: true,
        customMethod: true,
      })),
      fetch: jest.fn(),
    } as any;
    simulatePutEvent = (e: any = event) => {
      mockEventSource.addEventListener.mock.calls[0][1](e); // put listener is at position 0
    };
    simulatePingEvent = () => {
      mockEventSource.addEventListener.mock.calls[2][1](); // ping listener is at position 2
    };
    simulateError = (e: { status: number; message: string }): boolean =>
      mockEventSource.options.errorFilter(e);

    listeners = new Map();
    mockListener = {
      deserializeData: jest.fn((data) => data),
      processJson: jest.fn(),
    };
    listeners.set('put', mockListener);
    listeners.set('patch', mockListener);

    diagnosticsManager = new internal.DiagnosticsManager(sdkKey, basicPlatform, {});
  });

  afterEach(() => {
    streamingProcessor.close();
    jest.resetAllMocks();
  });

  it('uses expected uri and eventSource init args', () => {
    streamingProcessor = new StreamingProcessor(
      'mockContextString',
      getStreamingDataSourceConfig(),
      listeners,
      basicPlatform.requests,
      basicPlatform.encoding!,
      makeTestRequestor({
        requests: basicPlatform.requests,
      }),
      diagnosticsManager,
      mockErrorHandler,
      logger,
    );
    streamingProcessor.start();

    expect(basicPlatform.requests.createEventSource).toBeCalledWith(
      `${serviceEndpoints.streaming}/stream/path/get?filter=testPayloadFilterKey`,
      {
        errorFilter: expect.any(Function),
        headers: defaultHeaders(sdkKey, info, undefined),
        initialRetryDelayMillis: 1000,
        readTimeoutMillis: 300000,
        retryResetIntervalMillis: 60000,
      },
    );
  });

  it('sets streamInitialReconnectDelay correctly', () => {
    streamingProcessor = new StreamingProcessor(
      'mockContextString',
      getStreamingDataSourceConfig(),
      listeners,
      basicPlatform.requests,
      basicPlatform.encoding!,
      makeTestRequestor({
        requests: basicPlatform.requests,
      }),
      diagnosticsManager,
      mockErrorHandler,
    );
    streamingProcessor.start();

    expect(basicPlatform.requests.createEventSource).toHaveBeenLastCalledWith(
      `${serviceEndpoints.streaming}/stream/path/get?filter=testPayloadFilterKey`,
      {
        errorFilter: expect.any(Function),
        headers: defaultHeaders(sdkKey, info, undefined),
        initialRetryDelayMillis: 1000,
        readTimeoutMillis: 300000,
        retryResetIntervalMillis: 60000,
      },
    );
  });

  it('uses the report path and modifies init dict when useReport is true ', () => {
    streamingProcessor = new StreamingProcessor(
      'mockContextString',
      getStreamingDataSourceConfig(true, true),
      listeners,
      basicPlatform.requests,
      basicPlatform.encoding!,
      makeTestRequestor({
        requests: basicPlatform.requests,
      }),
      diagnosticsManager,
      mockErrorHandler,
    );
    streamingProcessor.start();

    expect(basicPlatform.requests.createEventSource).toHaveBeenLastCalledWith(
      `${serviceEndpoints.streaming}/stream/path/report?withReasons=true&filter=testPayloadFilterKey`,
      expect.objectContaining({
        method: 'REPORT',
        body: 'mockContextString',
        errorFilter: expect.any(Function),
        headers: expect.objectContaining({ 'content-type': 'application/json' }),
        initialRetryDelayMillis: 1000,
        readTimeoutMillis: 300000,
        retryResetIntervalMillis: 60000,
      }),
    );
  });

  it('withReasons and payload filter coexist', () => {
    streamingProcessor = new StreamingProcessor(
      'mockContextString',
      getStreamingDataSourceConfig(true, false),
      listeners,
      basicPlatform.requests,
      basicPlatform.encoding!,
      makeTestRequestor({
        requests: basicPlatform.requests,
      }),
      diagnosticsManager,
      mockErrorHandler,
    );
    streamingProcessor.start();

    expect(basicPlatform.requests.createEventSource).toHaveBeenLastCalledWith(
      `${serviceEndpoints.streaming}/stream/path/get?withReasons=true&filter=testPayloadFilterKey`,
      {
        errorFilter: expect.any(Function),
        headers: defaultHeaders(sdkKey, info, undefined),
        initialRetryDelayMillis: 1000,
        readTimeoutMillis: 300000,
        retryResetIntervalMillis: 60000,
      },
    );
  });

  it('adds listeners', () => {
    streamingProcessor = new StreamingProcessor(
      'mockContextString',
      getStreamingDataSourceConfig(),
      listeners,
      basicPlatform.requests,
      basicPlatform.encoding!,
      makeTestRequestor({
        requests: basicPlatform.requests,
      }),
      diagnosticsManager,
      mockErrorHandler,
      logger,
    );
    streamingProcessor.start();

    expect(mockEventSource.addEventListener).toHaveBeenNthCalledWith(
      1,
      'put',
      expect.any(Function),
    );
    expect(mockEventSource.addEventListener).toHaveBeenNthCalledWith(
      2,
      'patch',
      expect.any(Function),
    );
  });

  it('executes listeners', () => {
    streamingProcessor = new StreamingProcessor(
      'mockContextString',
      getStreamingDataSourceConfig(),
      listeners,
      basicPlatform.requests,
      basicPlatform.encoding!,
      makeTestRequestor({
        requests: basicPlatform.requests,
      }),
      diagnosticsManager,
      mockErrorHandler,
      logger,
    );
    streamingProcessor.start();

    simulatePutEvent();
    const patchHandler = mockEventSource.addEventListener.mock.calls[1][1];
    patchHandler(event);

    expect(mockListener.deserializeData).toBeCalledTimes(2);
    expect(mockListener.processJson).toBeCalledTimes(2);
  });

  it('passes error to callback if json data is malformed', async () => {
    streamingProcessor = new StreamingProcessor(
      'mockContextString',
      getStreamingDataSourceConfig(),
      listeners,
      basicPlatform.requests,
      basicPlatform.encoding!,
      makeTestRequestor({
        requests: basicPlatform.requests,
      }),
      diagnosticsManager,
      mockErrorHandler,
      logger,
    );
    streamingProcessor.start();

    (mockListener.deserializeData as jest.Mock).mockReturnValue(false);
    simulatePutEvent();

    expect(logger.error).toBeCalledWith(expect.stringMatching(/invalid data in "put"/));
    expect(logger.debug).toBeCalledWith(expect.stringMatching(/invalid json/i));
    expect(mockErrorHandler.mock.lastCall[0].message).toMatch(/malformed json/i);
  });

  it('calls error handler if event.data prop is missing', async () => {
    streamingProcessor = new StreamingProcessor(
      'mockContextString',
      getStreamingDataSourceConfig(),
      listeners,
      basicPlatform.requests,
      basicPlatform.encoding!,
      makeTestRequestor({
        requests: basicPlatform.requests,
      }),
      diagnosticsManager,
      mockErrorHandler,
      logger,
    );
    streamingProcessor.start();

    simulatePutEvent({ flags: {} });

    expect(mockListener.deserializeData).not.toBeCalled();
    expect(mockListener.processJson).not.toBeCalled();
    expect(mockErrorHandler.mock.lastCall[0].message).toMatch(/unexpected payload/i);
  });

  it('closes and stops', async () => {
    streamingProcessor = new StreamingProcessor(
      'mockContextString',
      getStreamingDataSourceConfig(),
      listeners,
      basicPlatform.requests,
      basicPlatform.encoding!,
      makeTestRequestor({
        requests: basicPlatform.requests,
      }),
      diagnosticsManager,
      mockErrorHandler,
      logger,
    );

    jest.spyOn(streamingProcessor, 'stop');
    streamingProcessor.start();
    streamingProcessor.close();

    expect(streamingProcessor.stop).toBeCalled();
    expect(mockEventSource.close).toBeCalled();
    // @ts-ignore
    expect(streamingProcessor.eventSource).toBeUndefined();
  });

  it('creates a stream init event', async () => {
    streamingProcessor = new StreamingProcessor(
      'mockContextString',
      getStreamingDataSourceConfig(),
      listeners,
      basicPlatform.requests,
      basicPlatform.encoding!,
      makeTestRequestor({
        requests: basicPlatform.requests,
      }),
      diagnosticsManager,
      mockErrorHandler,
      logger,
    );
    streamingProcessor.start();

    const startTime = Date.now();
    simulatePutEvent();

    const diagnosticEvent = diagnosticsManager.createStatsEventAndReset(0, 0, 0);
    expect(diagnosticEvent.streamInits.length).toEqual(1);
    const si = diagnosticEvent.streamInits[0];
    expect(si.timestamp).toEqual(startTime);
    expect(si.failed).toBeFalsy();
    expect(si.durationMillis).toBeGreaterThanOrEqual(0);
  });

  describe.each([400, 408, 429, 500, 503])('given recoverable http errors', (status) => {
    it(`continues retrying after error: ${status}`, () => {
      streamingProcessor = new StreamingProcessor(
        'mockContextString',
        getStreamingDataSourceConfig(),
        listeners,
        basicPlatform.requests,
        basicPlatform.encoding!,
        makeTestRequestor({
          requests: basicPlatform.requests,
        }),
        diagnosticsManager,
        mockErrorHandler,
        logger,
      );
      streamingProcessor.start();

      const startTime = Date.now();
      const testError = { status, message: 'retry. recoverable.' };
      const willRetry = simulateError(testError);

      expect(willRetry).toBeTruthy();
      expect(mockErrorHandler).not.toBeCalled();
      expect(logger.warn).toBeCalledWith(
        expect.stringMatching(new RegExp(`${status}.*will retry`)),
      );

      const diagnosticEvent = diagnosticsManager.createStatsEventAndReset(0, 0, 0);
      expect(diagnosticEvent.streamInits.length).toEqual(1);
      const si = diagnosticEvent.streamInits[0];
      expect(si.timestamp).toEqual(startTime);
      expect(si.failed).toBeTruthy();
      expect(si.durationMillis).toBeGreaterThanOrEqual(0);
    });
  });

  describe.each([401, 403])('given irrecoverable http errors', (status) => {
    it(`stops retrying after error: ${status}`, () => {
      streamingProcessor = new StreamingProcessor(
        'mockContextString',
        getStreamingDataSourceConfig(),
        listeners,
        basicPlatform.requests,
        basicPlatform.encoding!,
        makeTestRequestor({
          requests: basicPlatform.requests,
        }),
        diagnosticsManager,
        mockErrorHandler,
        logger,
      );
      streamingProcessor.start();

      const startTime = Date.now();
      const testError = { status, message: 'stopping. irrecoverable.' };
      const willRetry = simulateError(testError);

      expect(willRetry).toBeFalsy();
      expect(mockErrorHandler).toBeCalledWith(
        new LDStreamingError(DataSourceErrorKind.Unknown, testError.message, testError.status),
      );
      expect(logger.error).toBeCalledWith(
        expect.stringMatching(new RegExp(`${status}.*permanently`)),
      );

      const diagnosticEvent = diagnosticsManager.createStatsEventAndReset(0, 0, 0);
      expect(diagnosticEvent.streamInits.length).toEqual(1);
      const si = diagnosticEvent.streamInits[0];
      expect(si.timestamp).toEqual(startTime);
      expect(si.failed).toBeTruthy();
      expect(si.durationMillis).toBeGreaterThanOrEqual(0);
    });
  });

  it('it uses ping stream and polling when use REPORT and eventsource lacks custom method support', async () => {
    basicPlatform.requests.getEventSourceCapabilities = jest.fn(() => ({
      readTimeout: true,
      headers: true,
      customMethod: false, // simulating event source does not support REPORT
    }));

    basicPlatform.requests.fetch = jest.fn().mockResolvedValue({
      headers: jest.doMock,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify(flagData)),
    });

    streamingProcessor = new StreamingProcessor(
      'mockContextString',
      getStreamingDataSourceConfig(true, true), // use report to true
      listeners,
      basicPlatform.requests,
      basicPlatform.encoding!,
      makeTestRequestor({
        requests: basicPlatform.requests,
        useReport: true,
      }),
      diagnosticsManager,
      mockErrorHandler,
    );
    streamingProcessor.start();

    simulatePingEvent();

    expect(basicPlatform.requests.createEventSource).toHaveBeenLastCalledWith(
      `${serviceEndpoints.streaming}/stream/path/ping?withReasons=true&filter=testPayloadFilterKey`,
      expect.anything(),
    );

    expect(basicPlatform.requests.fetch).toHaveBeenCalledWith(
      '/polling/path/report?withReasons=true&filter=testPayloadFilterKey',
      expect.objectContaining({
        method: 'REPORT',
        body: 'mockContextString',
      }),
    );
  });
});

it('includes custom query parameters', () => {
  const { info } = basicPlatform;
  const listeners = new Map();
  const mockListener = {
    deserializeData: jest.fn((data) => data),
    processJson: jest.fn(),
  };
  listeners.set('put', mockListener);
  listeners.set('patch', mockListener);
  const diagnosticsManager = new internal.DiagnosticsManager(sdkKey, basicPlatform, {});

  basicPlatform.requests = {
    createEventSource: jest.fn((streamUri: string, options: any) => {
      const mockEventSource = createMockEventSource(streamUri, options);
      return mockEventSource;
    }),
    getEventSourceCapabilities: jest.fn(() => ({
      readTimeout: true,
      headers: true,
      customMethod: true,
    })),
  } as any;

  const streamingProcessor = new StreamingProcessor(
    'mockContextString',
    getStreamingDataSourceConfig(undefined, undefined, [{ key: 'custom', value: 'value' }]),
    listeners,
    basicPlatform.requests,
    basicPlatform.encoding!,
    makeTestRequestor({
      requests: basicPlatform.requests,
    }),
    diagnosticsManager,
    () => {},
    logger,
  );

  streamingProcessor.start();

  expect(basicPlatform.requests.createEventSource).toHaveBeenCalledWith(
    `${serviceEndpoints.streaming}/stream/path/get?custom=value&filter=testPayloadFilterKey`,
    {
      errorFilter: expect.any(Function),
      headers: defaultHeaders(sdkKey, info, undefined),
      initialRetryDelayMillis: 1000,
      readTimeoutMillis: 300000,
      retryResetIntervalMillis: 60000,
    },
  );
});
