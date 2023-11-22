import { basicPlatform, logger } from '@launchdarkly/private-js-mocks';

import { EventName, HttpErrorResponse, ProcessStreamResponse } from '../../api';
import { LDStreamProcessor } from '../../api/subsystem';
import { LDStreamingError } from '../../errors';
import { shouldRetry } from '../../utils';
import { DiagnosticsManager } from '../diagnostics';
import StreamingProcessor from './StreamingProcessor';

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

const mockLegacyJSEventSource = {
  addEventListener: jest.fn(),
  close: jest.fn(),
  onclose: jest.fn(),
  onopen: jest.fn(),
  onretrying: jest.fn(),
  onerror: jest.fn(),
  options: {
    errorFilter: shouldRetry,
  },
};
const createLegacyJSEventSource = () => mockLegacyJSEventSource;
const simulateError = (e: HttpErrorResponse) => mockLegacyJSEventSource.onerror(e);
const simulatePutEvent = (e: any = event) => {
  mockLegacyJSEventSource.addEventListener.mock.calls[0][1](e);
};

describe('given a stream processor with mock event source', () => {
  let streamingProcessor: LDStreamProcessor;
  let diagnosticsManager: DiagnosticsManager;
  let listeners: Map<EventName, ProcessStreamResponse>;
  let mockListener: ProcessStreamResponse;
  let mockErrorHandler: jest.Mock;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(dateNowString));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    mockErrorHandler = jest.fn();

    listeners = new Map();
    mockListener = {
      deserializeData: jest.fn((data) => data),
      processJson: jest.fn(),
    };
    listeners.set('put', mockListener);
    listeners.set('patch', mockListener);

    diagnosticsManager = new DiagnosticsManager(sdkKey, basicPlatform, {});
    streamingProcessor = new StreamingProcessor(
      createLegacyJSEventSource,
      listeners,
      diagnosticsManager,
      mockErrorHandler,
      logger,
    );

    jest.spyOn(streamingProcessor, 'stop');
    streamingProcessor.start();
  });

  afterEach(() => {
    streamingProcessor.close();
    jest.resetAllMocks();
  });

  it('adds listeners', () => {
    expect(mockLegacyJSEventSource.addEventListener).toHaveBeenNthCalledWith(
      1,
      'put',
      expect.any(Function),
    );
    expect(mockLegacyJSEventSource.addEventListener).toHaveBeenNthCalledWith(
      2,
      'patch',
      expect.any(Function),
    );
  });

  it('executes listeners', () => {
    simulatePutEvent();
    const patchHandler = mockLegacyJSEventSource.addEventListener.mock.calls[1][1];
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
    expect(mockLegacyJSEventSource.close).toBeCalled();
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
      simulateError(testError);

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
      simulateError(testError);

      expect(mockErrorHandler).toBeCalledWith(
        new LDStreamingError(testError.message, testError.status),
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
