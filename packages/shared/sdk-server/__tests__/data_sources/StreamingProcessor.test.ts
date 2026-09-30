import {
  defaultHeaders,
  EventName,
  Info,
  internal,
  LDLogger,
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
      '/all',
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
    expect(basicPlatform.requests.createEventSource).toHaveBeenCalledWith(
      `${serviceEndpoints.streaming}/all`,
      {
        errorFilter: expect.any(Function),
        headers: defaultHeaders(sdkKey, info, undefined),
        readTimeoutMillis: 300000,
        retryDelayStrategy: {
          nextRetryDelay: expect.any(Function),
          setGoodSince: expect.any(Function),
          setBaseDelay: expect.any(Function),
        },
      },
    );
  });

  it('applies streamInitialReconnectDelay to the retry backoff', () => {
    streamingProcessor = new StreamingProcessor(
      {
        basicConfiguration: getBasicConfiguration(logger),
        platform: basicPlatform,
      },
      '/all',
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

    // The configured 22s initial delay is no longer an init-dict field; it
    // lives in the injected strategy. A first normal failure computes from it.
    mockEventSource.options.errorFilter({ status: 500, message: 'err' });
    const delay = mockEventSource.options.retryDelayStrategy.nextRetryDelay(0);
    expect(delay).toBeGreaterThan(11000);
    expect(delay).toBeLessThanOrEqual(22000);
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

    expect(mockListener.deserializeData).toHaveBeenCalledTimes(2);
    expect(mockListener.processJson).toHaveBeenCalledTimes(2);
  });

  it('passes initialization headers to listener', () => {
    const headers = {
      header1: 'value1',
      header2: 'value2',
      header3: 'value3',
    };
    mockEventSource.onopen({ type: 'open', headers });
    simulatePutEvent();
    expect(mockListener.processJson).toHaveBeenCalledTimes(1);
    expect(mockListener.processJson).toHaveBeenNthCalledWith(1, expect.any(Object), headers);
  });

  it('records a failure and reconnects when json data is malformed', () => {
    (mockListener.deserializeData as jest.Mock).mockReturnValue(false);
    const createSpy = basicPlatform.requests.createEventSource as jest.Mock;
    const callsBefore = createSpy.mock.calls.length;
    simulatePutEvent();

    expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/invalid data in "put"/));
    expect(logger.debug).toHaveBeenCalledWith(expect.stringMatching(/invalid json/i));
    // Recoverable now: surfaced as a log, not an 'error' event.
    expect(mockErrorHandler).not.toHaveBeenCalled();
    // The connection is fine but the data is not, so the stream is torn down
    // and re-established after the backoff wait.
    expect(mockEventSource.close).toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(createSpy.mock.calls.length).toEqual(callsBefore + 1);
  });

  it('does not double-reconnect when two invalid payloads arrive in one parse pass', () => {
    (mockListener.deserializeData as jest.Mock).mockReturnValue(false);
    const createSpy = basicPlatform.requests.createEventSource as jest.Mock;
    const callsBefore = createSpy.mock.calls.length;

    // Two malformed events delivered synchronously, before any reconnect timer
    // fires. The second must be a no-op — the first already tore the stream
    // down — so only one source is closed and only one reconnect is scheduled.
    simulatePutEvent();
    simulatePutEvent();

    expect(mockEventSource.close).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1000);
    expect(createSpy.mock.calls.length).toEqual(callsBefore + 1);
  });

  it('treats a deserialization that throws as invalid data and reconnects', () => {
    (mockListener.deserializeData as jest.Mock).mockImplementation(() => {
      throw new Error('structurally invalid');
    });
    const createSpy = basicPlatform.requests.createEventSource as jest.Mock;
    const callsBefore = createSpy.mock.calls.length;

    // A throw during deserialization must not escape the listener; it is
    // handled like any other invalid payload.
    expect(() => simulatePutEvent()).not.toThrow();

    expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/invalid data in "put"/));
    expect(mockErrorHandler).not.toHaveBeenCalled();
    expect(mockEventSource.close).toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(createSpy.mock.calls.length).toEqual(callsBefore + 1);
  });

  it('cancels a scheduled reconnect when stopped before it fires', () => {
    (mockListener.deserializeData as jest.Mock).mockReturnValue(false);
    const createSpy = basicPlatform.requests.createEventSource as jest.Mock;
    const callsBefore = createSpy.mock.calls.length;

    // Malformed data arms a reconnect timer; stopping must cancel it.
    simulatePutEvent();
    expect(mockEventSource.close).toHaveBeenCalled();

    streamingProcessor.stop();
    jest.advanceTimersByTime(5 * 60 * 1000);

    expect(createSpy.mock.calls.length).toEqual(callsBefore);
  });

  it('classifies a status-less transport error as a normal, retryable failure', () => {
    // No HTTP status → classifyTransportFailure() → normal: warn, keep retrying,
    // and do not surface it through the error handler.
    const willRetry = mockEventSource.options.errorFilter({ message: 'socket hang up' });

    expect(willRetry).toBeTruthy();
    expect(mockErrorHandler).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/will retry/));
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('counts a self-initiated restart after malformed data as a single failure', () => {
    const recordFailure = jest.spyOn((streamingProcessor as any)['_retryState'], 'recordFailure');
    (mockListener.deserializeData as jest.Mock).mockReturnValue(false);

    simulatePutEvent();

    // The malformed payload is one normal failure; the SDK's own close()
    // during the restart must not be counted as a second.
    expect(recordFailure).toHaveBeenCalledTimes(1);
    expect(recordFailure).toHaveBeenCalledWith('normal');
  });

  it('logs and restarts if event.data prop is missing', () => {
    simulatePutEvent({ flags: {} });

    expect(mockListener.deserializeData).not.toHaveBeenCalled();
    expect(mockListener.processJson).not.toHaveBeenCalled();
    expect(mockErrorHandler).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/unexpected payload/i));
  });

  it('logs the reconnect delay via onretrying, unchanged from prior behavior', () => {
    mockEventSource.onretrying({ delayMillis: 5000 });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringMatching(/Will retry stream connection in 5000 milliseconds/),
    );
  });

  it('closes and stops', async () => {
    streamingProcessor.close();

    expect(streamingProcessor.stop).toHaveBeenCalled();
    expect(mockEventSource.close).toHaveBeenCalled();
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
      expect(mockErrorHandler).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
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

  describe.each([401, 403])('given unexpected http errors', (status) => {
    it(`retries at error level rather than stopping after error: ${status}`, () => {
      const startTime = Date.now();
      const testError = { status, message: 'unexpected but still retried.' };
      const willRetry = simulateError(testError);

      // RETRY conformance abolishes permanent stops: 401/403 now retry, and
      // like any recoverable failure they surface as a log, not an 'error' event.
      expect(willRetry).toBeTruthy();
      expect(mockErrorHandler).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`${status}.*will retry`)),
      );

      const diagnosticEvent = diagnosticsManager.createStatsEventAndReset(0, 0, 0);
      expect(diagnosticEvent.streamInits.length).toEqual(1);
      const si = diagnosticEvent.streamInits[0];
      expect(si.timestamp).toEqual(startTime);
      expect(si.failed).toBeTruthy();
      expect(si.durationMillis).toBeGreaterThanOrEqual(0);
    });

    it(`enters the extended regime after error: ${status}`, () => {
      simulateError({ status, message: 'unexpected' });
      const delay = mockEventSource.options.retryDelayStrategy.nextRetryDelay(0);
      // Extended initial delay is 5 minutes, less up to half for jitter.
      expect(delay).toBeGreaterThan(2.5 * 60 * 1000);
      expect(delay).toBeLessThanOrEqual(5 * 60 * 1000);
    });
  });

  it('resets the reconnect delay to the operating cadence after a healthy event', () => {
    const strategy = mockEventSource.options.retryDelayStrategy;
    simulateError({ status: 500, message: 'transient' });
    expect(strategy.nextRetryDelay(0)).toBeGreaterThan(0);
    strategy.setGoodSince(0);
    expect(strategy.nextRetryDelay(0)).toEqual(0);
  });

  it('applies a server-directed retry time as the backoff base', () => {
    const strategy = mockEventSource.options.retryDelayStrategy;
    strategy.setBaseDelay(2500);
    simulateError({ status: 500, message: 'transient' });
    const delay = strategy.nextRetryDelay(0);
    expect(delay).toBeGreaterThan(1250);
    expect(delay).toBeLessThanOrEqual(2500);
  });
});
