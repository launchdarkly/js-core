import {
  DataSourceErrorKind,
  defaultHeaders,
  Info,
  internal,
  LDLogger,
  LDStreamingError,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import StreamingProcessorFDv2 from '../../src/data_sources/StreamingProcessorFDv2';
import { createBasicPlatform } from '../createBasicPlatform';

let logger: LDLogger;

const serviceEndpoints = {
  events: '',
  polling: '',
  streaming: 'https://mockstream.ld.com',
  diagnosticEventPath: '/diagnostic',
  analyticsEventPath: '/bulk',
  includeAuthorizationHeader: true,
};

function getBasicConfiguration(inLogger: LDLogger) {
  return {
    sdkKey: 'testSdkKey',
    serviceEndpoints,
    logger: inLogger,
  };
}

const dateNowString = '2023-08-10';
const sdkKey = 'my-sdk-key';
const events = {
  'server-intent': {
    data: '{"payloads": [{"code": "xfer-full", "id": "mockId"}]}',
  },
  'put-object': {
    data: '{"kind": "mockKind", "key": "flagA", "version": 123, "object": {"objectFieldA": "objectValueA"}}',
  },
  'payload-transferred': {
    data: '{"state": "mockState", "version": 1}',
  },
};

let basicPlatform: any;

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

describe('given a stream processor with mock event source', () => {
  let info: Info;
  let streamingProcessor: subsystem.LDStreamProcessor;
  let diagnosticsManager: internal.DiagnosticsManager;
  let listener: internal.PayloadListener;
  let mockEventSource: any;
  let mockErrorHandler: jest.Mock;
  let simulateEvents: (e?: any) => void;
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
    } as any;
    simulateEvents = (e: any = events) => {
      mockEventSource.addEventListener.mock.calls[0][1](e['server-intent']); // server intent listener
      mockEventSource.addEventListener.mock.calls[1][1](e['put-object']); // put listener
      mockEventSource.addEventListener.mock.calls[3][1](e['payload-transferred']); // payload transferred listener
    };
    simulateError = (e: { status: number; message: string }): boolean =>
      mockEventSource.options.errorFilter(e);

    listener = jest.fn();

    diagnosticsManager = new internal.DiagnosticsManager(sdkKey, basicPlatform, {});
    streamingProcessor = new StreamingProcessorFDv2(
      {
        basicConfiguration: getBasicConfiguration(logger),
        platform: basicPlatform,
      },
      '/all',
      [],
      listener,
      {
        authorization: 'my-sdk-key',
        'user-agent': 'TestUserAgent/2.0.2',
        'x-launchdarkly-wrapper': 'Rapper/1.2.3',
      },
      diagnosticsManager,
      mockErrorHandler,
    );

    jest.spyOn(streamingProcessor, 'stop');
    streamingProcessor.start();
  });

  afterEach(() => {
    streamingProcessor.close();
    jest.resetAllMocks();
  });

  it('uses expected uri and eventSource init args', () => {
    expect(basicPlatform.requests.createEventSource).toBeCalledWith(
      `${serviceEndpoints.streaming}/all`,
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
    streamingProcessor = new StreamingProcessorFDv2(
      {
        basicConfiguration: getBasicConfiguration(logger),
        platform: basicPlatform,
      },
      '/all',
      [],
      listener,
      {
        authorization: 'my-sdk-key',
        'user-agent': 'TestUserAgent/2.0.2',
        'x-launchdarkly-wrapper': 'Rapper/1.2.3',
      },
      diagnosticsManager,
      mockErrorHandler,
      22,
    );
    streamingProcessor.start();

    expect(basicPlatform.requests.createEventSource).toHaveBeenLastCalledWith(
      `${serviceEndpoints.streaming}/all`,
      {
        errorFilter: expect.any(Function),
        headers: defaultHeaders(sdkKey, info, undefined),
        initialRetryDelayMillis: 22000,
        readTimeoutMillis: 300000,
        retryResetIntervalMillis: 60000,
      },
    );
  });

  it('adds listeners', () => {
    expect(mockEventSource.addEventListener).toHaveBeenNthCalledWith(
      1,
      'server-intent',
      expect.any(Function),
    );
    expect(mockEventSource.addEventListener).toHaveBeenNthCalledWith(
      2,
      'put-object',
      expect.any(Function),
    );
    expect(mockEventSource.addEventListener).toHaveBeenNthCalledWith(
      3,
      'delete-object',
      expect.any(Function),
    );
    expect(mockEventSource.addEventListener).toHaveBeenNthCalledWith(
      4,
      'payload-transferred',
      expect.any(Function),
    );
    expect(mockEventSource.addEventListener).toHaveBeenNthCalledWith(
      5,
      'goodbye',
      expect.any(Function),
    );
    expect(mockEventSource.addEventListener).toHaveBeenNthCalledWith(
      6,
      'error',
      expect.any(Function),
    );
  });

  it('executes payload listener', () => {
    simulateEvents();
    expect(listener).toHaveBeenCalled();
  });

  it('passes error to callback if json data is malformed', async () => {
    simulateEvents({
      'server-intent': {
        data: '{"payloads": [{"intent INTENTIONAL CORRUPTION MUWAHAHAHA',
      },
    });

    expect(mockErrorHandler.mock.calls[0][0].kind).toEqual(DataSourceErrorKind.InvalidData);
    expect(mockErrorHandler.mock.calls[0][0].message).toEqual('Malformed data in event stream');
  });

  it('calls error handler if event.data prop is missing', async () => {
    simulateEvents({
      'server-intent': {
        notData: '{"payloads": [{"intentCode": "xfer-full", "id": "mockId"}]}',
      },
      'put-object': {
        notData:
          '{"kind": "mockKind", "key": "flagA", "version": 123, "object": {"objectFieldA": "objectValueA"}}',
      },
      'payload-transferred': {
        notData: '{"state": "mockState", "version": 1}',
      },
    });
    expect(listener).not.toHaveBeenCalled();
    expect(mockErrorHandler.mock.calls[0][0].kind).toEqual(DataSourceErrorKind.Unknown);
    expect(mockErrorHandler.mock.calls[0][0].message).toMatch(/unexpected message/i);
  });

  it('closes and stops', async () => {
    streamingProcessor.close();

    expect(streamingProcessor.stop).toBeCalled();
    expect(mockEventSource.close).toBeCalled();
    // @ts-ignore
    expect(streamingProcessor.eventSource).toBeUndefined();
  });

  it('creates a stream init event', async () => {
    const startTime = Date.now();
    simulateEvents();

    const diagnosticEvent = diagnosticsManager.createStatsEventAndReset(0, 0, 0);
    expect(diagnosticEvent.streamInits.length).toEqual(1);
    const si = diagnosticEvent.streamInits[0];
    expect(si.timestamp).toEqual(startTime);
    expect(si.failed).toBeFalsy();
    expect(si.durationMillis).toBeGreaterThanOrEqual(0);
  });

  describe.each([400, 408, 429, 500, 503])('given recoverable http errors', (status) => {
    it(`continues retrying after error: ${status}`, () => {
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
});
