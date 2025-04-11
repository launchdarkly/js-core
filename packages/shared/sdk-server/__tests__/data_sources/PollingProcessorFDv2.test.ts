import { DataSourceErrorKind, LDPollingError, subsystem } from '../../src';
import PollingProcessorFDv2 from '../../src/data_sources/PollingProcessorFDv2';
import Requestor from '../../src/data_sources/Requestor';
import TestLogger, { LogLevel } from '../Logger';

describe('given an event processor', () => {
  const requestor = {
    requestAllData: jest.fn(),
  };
  const longInterval = 100000;
  const allEvents = {
    events: [
      {
        event: 'server-intent',
        data: { payloads: [{ code: 'xfer-full', id: 'mockId' }] },
      },
      {
        event: 'put-object',
        data: {
          kind: 'flag',
          key: 'flagA',
          version: 123,
          object: { objectFieldA: 'objectValueA' },
        },
      },
      {
        event: 'payload-transferred',
        data: { state: 'mockState', version: 1 },
      },
    ],
  };
  const jsonData = JSON.stringify(allEvents);

  let processor: PollingProcessorFDv2;
  const mockDataCallback = jest.fn();
  const mockStatusCallback = jest.fn();

  beforeEach(() => {
    processor = new PollingProcessorFDv2(
      requestor as unknown as Requestor,
      longInterval,
      new TestLogger(),
    );
  });

  afterEach(() => {
    processor.stop();
    jest.restoreAllMocks();
  });

  it('makes no requests before being started', () => {
    expect(requestor.requestAllData).not.toHaveBeenCalled();
  });

  it('polls immediately on start', () => {
    processor.start(mockDataCallback, mockStatusCallback);
    expect(requestor.requestAllData).toHaveBeenCalledTimes(1);
    expect(mockDataCallback).not.toHaveBeenCalled();
    expect(mockStatusCallback).toHaveBeenNthCalledWith(1, subsystem.DataSourceState.Initializing);
  });

  it('calls callback on success', () => {
    requestor.requestAllData = jest.fn((cb) => cb(undefined, jsonData));
    processor.start(mockDataCallback, mockStatusCallback);
    expect(mockDataCallback).toHaveBeenNthCalledWith(1, true, {
      basis: true,
      id: `mockId`,
      state: `mockState`,
      updates: [
        {
          kind: `flag`,
          key: `flagA`,
          version: 123,
          object: { objectFieldA: 'objectValueA' },
        },
      ],
      version: 1,
    });
  });
});

describe('given a polling processor with a short poll duration', () => {
  const requestor = {
    requestAllData: jest.fn(),
  };
  const shortInterval = 0.1;
  const allEvents = {
    events: [
      {
        event: 'server-intent',
        data: { payloads: [{ code: 'xfer-full', id: 'mockId' }] },
      },
      {
        event: 'put-object',
        data: {
          kind: 'flag',
          key: 'flagA',
          version: 123,
          object: { objectFieldA: 'objectValueA' },
        },
      },
      {
        event: 'payload-transferred',
        data: { state: 'mockState', version: 1 },
      },
    ],
  };
  const jsonData = JSON.stringify(allEvents);

  let testLogger: TestLogger;
  let processor: PollingProcessorFDv2;
  const mockDataCallback = jest.fn();
  const mockStatusCallback = jest.fn();

  beforeEach(() => {
    testLogger = new TestLogger();

    processor = new PollingProcessorFDv2(
      requestor as unknown as Requestor,
      shortInterval,
      testLogger,
    );
  });

  afterEach(() => {
    processor.stop();
    jest.resetAllMocks();
  });

  it('polls repeatedly', (done) => {
    requestor.requestAllData = jest.fn((cb) => cb(undefined, jsonData));

    processor.start(mockDataCallback, mockStatusCallback);
    setTimeout(() => {
      expect(requestor.requestAllData.mock.calls.length).toBeGreaterThanOrEqual(4);
      done();
    }, 500);
  });

  it.each<number | jest.DoneCallback>([400, 408, 429, 500, 503])(
    'continues polling after recoverable error',
    (status, done) => {
      requestor.requestAllData = jest.fn((cb) =>
        cb(
          {
            status,
          },
          undefined,
        ),
      );

      processor.start(mockDataCallback, mockStatusCallback);
      expect(mockDataCallback).not.toHaveBeenCalled();
      expect(mockStatusCallback).toHaveBeenNthCalledWith(1, subsystem.DataSourceState.Initializing);
      expect(mockStatusCallback).toHaveBeenNthCalledWith(
        2,
        subsystem.DataSourceState.Interrupted,
        new LDPollingError(
          DataSourceErrorKind.ErrorResponse,
          `Received error ${status} for polling request - will retry`,
          status as number,
        ),
      );
      setTimeout(() => {
        expect(requestor.requestAllData.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(testLogger.getCount(LogLevel.Error)).toBe(0);
        expect(testLogger.getCount(LogLevel.Warn)).toBeGreaterThan(2);
        (done as jest.DoneCallback)();
      }, 300);
    },
  );

  it('continues polling after receiving invalid JSON', (done) => {
    requestor.requestAllData = jest.fn((cb) => cb(undefined, '{sad'));

    processor.start(mockDataCallback, mockStatusCallback);
    expect(mockDataCallback).not.toHaveBeenCalled();
    expect(mockStatusCallback).toHaveBeenNthCalledWith(1, subsystem.DataSourceState.Initializing);
    expect(mockStatusCallback).toHaveBeenNthCalledWith(
      2,
      subsystem.DataSourceState.Interrupted,
      new LDPollingError(
        DataSourceErrorKind.ErrorResponse,
        `Malformed JSON data in polling response`,
      ),
    );

    setTimeout(() => {
      expect(requestor.requestAllData.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(testLogger.getCount(LogLevel.Error)).toBeGreaterThan(2);
      (done as jest.DoneCallback)();
    }, 300);
  });

  it.each<number | jest.DoneCallback>([401, 403])(
    'does not continue after non-recoverable error',
    (status, done) => {
      requestor.requestAllData = jest.fn((cb) =>
        cb(
          {
            status,
          },
          undefined,
        ),
      );
      processor.start(mockDataCallback, mockStatusCallback);
      expect(mockDataCallback).not.toHaveBeenCalled();
      expect(mockStatusCallback).toHaveBeenNthCalledWith(1, subsystem.DataSourceState.Initializing);
      expect(mockStatusCallback).toHaveBeenNthCalledWith(
        2,
        subsystem.DataSourceState.Interrupted,
        new LDPollingError(
          DataSourceErrorKind.ErrorResponse,
          status === 401
            ? `Received error ${status} (invalid SDK key) for polling request - giving up permanently`
            : `Received error ${status} for polling request - giving up permanently`,
          status as number,
        ),
      );
      setTimeout(() => {
        expect(requestor.requestAllData.mock.calls.length).toBe(1);
        expect(testLogger.getCount(LogLevel.Error)).toBe(1);
        (done as jest.DoneCallback)();
      }, 300);
    },
  );
});
