import {
  DataSourceErrorKind,
  defaultHeaders,
  EventName,
  Info,
  internal,
  LDLogger,
  LDStreamingError,
  ProcessStreamResponse,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import StreamingProcessor from '../../src/data_sources/StreamingProcessor';
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
const event = {
  data: {
    flags: {
      flagkey: { key: 'flagkey', version: 1 },
    },
    segments: {
      segkey: { key: 'segkey', version: 2 },
    },
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
  let listeners: Map<EventName, ProcessStreamResponse>;
  let mockEventSource: any;
  let mockListener: ProcessStreamResponse;
  let mockErrorHandler: jest.Mock;
  let simulatePutEvent: (e?: any) => void;
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
    simulatePutEvent = (e: any = event) => {
      mockEventSource.addEventListener.mock.calls[0][1](e);
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
    streamingProcessor = new StreamingProcessor(
      {
        basicConfiguration: getBasicConfiguration(logger),
        platform: basicPlatform,
      },
      '/sdk/stream',
      [],
      listeners,
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
      `${serviceEndpoints.streaming}/sdk/stream`,
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
      {
        basicConfiguration: getBasicConfiguration(logger),
        platform: basicPlatform,
      },
      '/sdk/stream',
      [],
      listeners,
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
      `${serviceEndpoints.streaming}/sdk/stream`,
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
    simulatePutEvent();
    const patchHandler = mockEventSource.addEventListener.mock.calls[1][1];
    patchHandler(event);

    expect(mockListener.deserializeData).toBeCalledTimes(2);
    expect(mockListener.processJson).toBeCalledTimes(2);
  });

  it('passes error to callback if json data is malformed', async () => {
    (mockListener.deserializeData as jest.Mock).mockReturnValue(false);
    simulatePutEvent();

    expect(logger.error).toBeCalledWith(expect.stringMatching(/invalid data in "put"/));
    expect(logger.debug).toBeCalledWith(expect.stringMatching(/invalid json/i));
    expect(mockErrorHandler.mock.lastCall[0].message).toMatch(/malformed json/i);
  });

  it('calls error handler if event.data prop is missing', async () => {
    simulatePutEvent({ flags: {} });

    expect(mockListener.deserializeData).not.toBeCalled();
    expect(mockListener.processJson).not.toBeCalled();
    expect(mockErrorHandler.mock.lastCall[0].message).toMatch(/unexpected payload/i);
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
