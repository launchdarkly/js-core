import { LDFlagDeliveryFallbackError } from '@launchdarkly/js-sdk-common';

import { DataSourceErrorKind, LDPollingError, subsystem } from '../../src';
import PollingProcessorFDv2 from '../../src/data_sources/PollingProcessorFDv2';
import Requestor from '../../src/data_sources/Requestor';
import TestLogger, { LogLevel } from '../Logger';

describe('given a polling processor', () => {
  const requestor = {
    requestAllData: jest.fn(),
  };
  const longInterval = 100000;
  const headers = {
    'x-ld-envid': 'envKey',
  };
  const allFDv2Events = {
    events: [
      {
        event: 'server-intent',
        data: { payloads: [{ intentCode: 'xfer-full', id: 'mockId' }] },
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
  const fdv2JsonData = JSON.stringify(allFDv2Events);

  const allFDv1Data = {
    flags: { flagA: { version: 456 } },
    segments: { segmentA: { version: 789 } },
  };
  const fdv1JsonData = JSON.stringify(allFDv1Data);

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

  it('calls callback on success', async () => {
    requestor.requestAllData = jest.fn((cb) => cb(undefined, fdv2JsonData, headers));
    let dataCallback;
    await new Promise<void>((resolve) => {
      dataCallback = jest.fn(() => {
        resolve();
      });

      processor.start(dataCallback, mockStatusCallback);
    });

    expect(dataCallback).toHaveBeenNthCalledWith(1, true, {
      initMetadata: {
        environmentId: 'envKey',
      },
      payload: {
        type: 'full',
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
      },
    });
  });

  it('can process FDv1 data when configured to do so', async () => {
    processor = new PollingProcessorFDv2(
      requestor as unknown as Requestor,
      longInterval,
      new TestLogger(),
      true,
    );
    requestor.requestAllData = jest.fn((cb) => cb(undefined, fdv1JsonData, headers));
    let dataCallback;
    await new Promise<void>((resolve) => {
      dataCallback = jest.fn(() => {
        resolve();
      });

      processor.start(dataCallback, mockStatusCallback);
    });

    expect(dataCallback).toHaveBeenNthCalledWith(1, true, {
      initMetadata: {
        environmentId: 'envKey',
      },
      payload: {
        type: 'full',
        state: `FDv1Fallback`,
        updates: [
          {
            kind: `flag`,
            key: `flagA`,
            version: 456,
            object: { version: 456 },
          },
          {
            kind: `segment`,
            key: `segmentA`,
            version: 789,
            object: { version: 789 },
          },
        ],
        version: 1,
      },
    });
  });

  // Per the FDv2 spec, the fallback directive can ride along on a successful response.
  // The processor must apply the payload first, then emit the fallback signal so that the
  // CompositeDataSource can swap to the FDv1 synchronizer.
  it('applies payload then signals fallback when fallback header rides along on a 200', async () => {
    requestor.requestAllData = jest.fn((cb) => cb(undefined, fdv2JsonData, headers, true));

    let dataCallback;
    let resolveStatus: () => void = () => {};
    const sawFallback = new Promise<void>((resolve) => {
      resolveStatus = resolve;
    });
    const statusCallback = jest.fn((state, err) => {
      if (state === subsystem.DataSourceState.Closed && err instanceof LDFlagDeliveryFallbackError) {
        resolveStatus();
      }
    });

    await new Promise<void>((resolve) => {
      dataCallback = jest.fn(() => {
        resolve();
      });
      processor.start(dataCallback, statusCallback);
    });

    await sawFallback;

    // The server-provided data was applied before the fallback signal was emitted.
    expect(dataCallback).toHaveBeenCalledTimes(1);
    const lastCall = statusCallback.mock.calls[statusCallback.mock.calls.length - 1];
    expect(lastCall[0]).toBe(subsystem.DataSourceState.Closed);
    expect(lastCall[1]).toBeInstanceOf(LDFlagDeliveryFallbackError);
  });

  // When the fallback directive arrives alongside an error response, the processor must
  // emit the directive without scheduling a retry, even if the status would otherwise be
  // recoverable.
  it('signals fallback on an error response without retrying', async () => {
    requestor.requestAllData = jest.fn((cb) =>
      cb({ status: 500 }, undefined, headers, true),
    );

    const statusCallback = jest.fn();
    processor.start(mockDataCallback, statusCallback);

    // Wait for the synchronous fallback emission.
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(requestor.requestAllData).toHaveBeenCalledTimes(1);
    const lastCall = statusCallback.mock.calls[statusCallback.mock.calls.length - 1];
    expect(lastCall[0]).toBe(subsystem.DataSourceState.Closed);
    expect(lastCall[1]).toBeInstanceOf(LDFlagDeliveryFallbackError);
  });

  it('uses selectorGetter when provided', async () => {
    processor = new PollingProcessorFDv2(
      requestor as unknown as Requestor,
      longInterval,
      new TestLogger(),
      true,
    );
    requestor.requestAllData = jest.fn((cb) => cb(undefined, fdv2JsonData, headers));
    let dataCallback;
    await new Promise<void>((resolve) => {
      dataCallback = jest.fn(() => {
        resolve();
      });

      processor.start(dataCallback, mockStatusCallback, () => 'mockSelector');
    });

    expect(requestor.requestAllData).toHaveBeenNthCalledWith(1, expect.anything(), [
      { key: 'basis', value: 'mockSelector' },
    ]);
  });
});

describe('given a polling processor with a short poll duration', () => {
  const requestor = {
    requestAllData: jest.fn(),
  };
  const shortInterval = 0.1;
  const headers = {
    'x-ld-envid': 'envKey',
  };
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

  it('polls repeatedly', async () => {
    const expectedCalls = new Promise<void>((resolve) => {
      let callCount = 0;
      requestor.requestAllData = jest.fn((cb) => {
        cb(undefined, jsonData, headers);
        callCount += 1;
        if (callCount >= 5) {
          resolve();
        }
      });
    });

    processor.start(mockDataCallback, mockStatusCallback);
    await expectedCalls;
  });

  it.each<number>([400, 408, 429, 500, 503])(
    'continues polling after recoverable error',
    async (status) => {
      const expectedCalls = new Promise<void>((resolve) => {
        let callCount = 0;
        requestor.requestAllData = jest.fn((cb) => {
          cb({ status }, undefined);
          callCount += 1;
          if (callCount >= 5) {
            resolve();
          }
        });
      });

      processor.start(mockDataCallback, mockStatusCallback);
      await expectedCalls;

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
      expect(requestor.requestAllData.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(testLogger.getCount(LogLevel.Error)).toBe(0);
      expect(testLogger.getCount(LogLevel.Warn)).toBeGreaterThan(2);
    },
  );

  it('continues polling after receiving invalid JSON', async () => {
    const expectedCalls = new Promise<void>((resolve) => {
      let callCount = 0;
      requestor.requestAllData = jest.fn((cb) => {
        cb(undefined, '{sad', headers);
        callCount += 1;
        if (callCount >= 5) {
          resolve();
        }
      });
    });

    processor.start(mockDataCallback, mockStatusCallback);
    await expectedCalls;

    expect(mockDataCallback).not.toHaveBeenCalled();
    expect(mockStatusCallback).toHaveBeenNthCalledWith(1, subsystem.DataSourceState.Initializing);
    expect(mockStatusCallback).toHaveBeenNthCalledWith(
      2,
      subsystem.DataSourceState.Interrupted,
      new LDPollingError(DataSourceErrorKind.ErrorResponse, `Malformed data in polling response`),
    );

    expect(requestor.requestAllData.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(testLogger.getCount(LogLevel.Error)).toBeGreaterThan(2);
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
        subsystem.DataSourceState.Closed,
        new LDPollingError(
          DataSourceErrorKind.ErrorResponse,
          status === 401
            ? `Received error ${status} (invalid SDK key) for polling request - giving up permanently`
            : `Received error ${status} for polling request - giving up permanently`,
          status as number,
          false,
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
