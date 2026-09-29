import { LDFeatureStore } from '../../src';
import PollingProcessor from '../../src/data_sources/PollingProcessor';
import Requestor from '../../src/data_sources/Requestor';
import AsyncStoreFacade from '../../src/store/AsyncStoreFacade';
import InMemoryFeatureStore from '../../src/store/InMemoryFeatureStore';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';
import TestLogger, { LogLevel } from '../Logger';

describe('given a polling processor', () => {
  const requestor = {
    requestAllData: jest.fn(),
  };
  const longInterval = 100000;
  const allData = {
    flags: { flag: { version: 1 } },
    segments: { segment: { version: 1 } },
  };
  const jsonData = JSON.stringify(allData);

  let store: LDFeatureStore;
  let storeFacade: AsyncStoreFacade;
  let processor: PollingProcessor;
  let initSuccessHandler: jest.Mock;

  beforeEach(() => {
    store = new InMemoryFeatureStore();
    storeFacade = new AsyncStoreFacade(store);
    initSuccessHandler = jest.fn();

    processor = new PollingProcessor(
      requestor as unknown as Requestor,
      longInterval,
      store,
      new TestLogger(),
      initSuccessHandler,
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
    processor.start();

    expect(requestor.requestAllData).toHaveBeenCalledTimes(1);
  });

  it('calls callback on success', () => {
    requestor.requestAllData = jest.fn((cb) => cb(undefined, jsonData));
    processor.start();
    expect(initSuccessHandler).toBeCalled();
  });

  it('initializes the feature store', async () => {
    requestor.requestAllData = jest.fn((cb) => cb(undefined, jsonData));

    processor.start();
    const flags = await storeFacade.all(VersionedDataKinds.Features);
    const segments = await storeFacade.all(VersionedDataKinds.Segments);

    expect(flags).toEqual(allData.flags);
    expect(segments).toEqual(allData.segments);
  });

  it('initializes the feature store with metadata', () => {
    const initHeaders = {
      'x-ld-envid': '12345',
    };
    requestor.requestAllData = jest.fn((cb) => cb(undefined, jsonData, initHeaders));

    processor.start();
    const metadata = storeFacade.getInitMetadata?.();

    expect(metadata).toEqual({ environmentId: '12345' });
  });
});

describe('given a polling processor with a short poll duration', () => {
  const requestor = {
    requestAllData: jest.fn(),
  };
  const shortInterval = 0.1;
  const allData = { flags: { flag: { version: 1 } }, segments: { segment: { version: 1 } } };
  const jsonData = JSON.stringify(allData);

  let store: LDFeatureStore;
  let testLogger: TestLogger;
  let processor: PollingProcessor;
  let initSuccessHandler: jest.Mock;
  let errorHandler: jest.Mock;

  beforeEach(() => {
    store = new InMemoryFeatureStore();
    testLogger = new TestLogger();
    initSuccessHandler = jest.fn();
    errorHandler = jest.fn();

    processor = new PollingProcessor(
      requestor as unknown as Requestor,
      shortInterval,
      store,
      testLogger,
      initSuccessHandler,
      errorHandler,
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
        cb(undefined, jsonData);
        callCount += 1;
        if (callCount >= 10) {
          resolve();
        }
      });

      processor.start();
    });

    await expectedCalls;
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

      processor.start();

      expect(initSuccessHandler).not.toBeCalled();
      expect(errorHandler).not.toBeCalled();
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

    processor.start();

    expect(initSuccessHandler).not.toBeCalled();
    expect(errorHandler).not.toBeCalled();

    setTimeout(() => {
      expect(requestor.requestAllData.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(testLogger.getCount(LogLevel.Error)).toBeGreaterThan(2);
      (done as jest.DoneCallback)();
    }, 300);
  });

  it('continues polling when deserialization throws on structurally invalid data', (done) => {
    // Parses as JSON but throws during the revive step (here, a null flag
    // entry). It must be handled like unparseable data, not escape and kill
    // the poll loop.
    requestor.requestAllData = jest.fn((cb) => cb(undefined, '{"flags":{"x":null},"segments":{}}'));

    processor.start();

    expect(initSuccessHandler).not.toBeCalled();
    expect(errorHandler).not.toBeCalled();

    setTimeout(() => {
      expect(requestor.requestAllData.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(testLogger.getCount(LogLevel.Error)).toBeGreaterThan(2);
      (done as jest.DoneCallback)();
    }, 300);
  });

  it.each([401, 403])(
    'retries with extended backoff rather than stopping after error %p',
    (status) => {
      jest.useFakeTimers();
      try {
        requestor.requestAllData = jest.fn((cb) => cb({ status }, undefined));
        processor.start();

        expect(initSuccessHandler).not.toBeCalled();
        expect(requestor.requestAllData).toHaveBeenCalledTimes(1);
        // Previously terminal; now an 'error'-level *log* that keeps retrying —
        // like any recoverable failure, it is not surfaced as an 'error' event.
        expect(errorHandler).not.toBeCalled();
        expect(testLogger.getCount(LogLevel.Error)).toBe(1);

        // Not a permanent stop: an unexpected failure schedules the next poll in
        // the extended regime (~5 minutes), so polling resumes after that wait.
        jest.advanceTimersByTime(5 * 60 * 1000);
        expect(requestor.requestAllData.mock.calls.length).toBeGreaterThanOrEqual(2);
      } finally {
        jest.useRealTimers();
      }
    },
  );
});
