import { LDFeatureStore } from '../../src/api/subsystems';
import promisify from '../../src/async/promisify';
import PollingProcessor from '../../src/data_sources/PollingProcessor';
import Requestor from '../../src/data_sources/Requestor';
import Configuration from '../../src/options/Configuration';
import AsyncStoreFacade from '../../src/store/AsyncStoreFacade';
import InMemoryFeatureStore from '../../src/store/InMemoryFeatureStore';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';
import TestLogger, { LogLevel } from '../Logger';

describe('given an event processor', () => {
  const requestor = {
    requestAllData: jest.fn()
  };
  const longInterval = 100000;
  const allData = { flags: { flag: { version: 1 } }, segments: { segment: { version: 1 } } };
  const jsonData = JSON.stringify(allData);

  let store: LDFeatureStore;
  let storeFacade: AsyncStoreFacade;
  let config: Configuration;
  let processor: PollingProcessor;


  beforeEach(() => {
    store = new InMemoryFeatureStore();
    storeFacade = new AsyncStoreFacade(store);
    config = new Configuration({
      featureStore: store,
      pollInterval: longInterval,
      logger: new TestLogger()
    });
    processor = new PollingProcessor(config, requestor as unknown as Requestor);
  });

  afterEach(() => {
    processor.stop();
    jest.restoreAllMocks();
  });

  it('makes no requests before being started', () => {
    expect(requestor.requestAllData).not.toHaveBeenCalled();
  });

  it('polls immediately on start', () => {
    processor.start(() => { });

    expect(requestor.requestAllData).toHaveBeenCalledTimes(1);
  });

  it('calls callback on success', (done) => {
    requestor.requestAllData = jest.fn((cb) => cb(undefined, jsonData));

    processor.start(() => done());
  });

  it('initializes the feature store', async () => {
    requestor.requestAllData = jest.fn((cb) => cb(undefined, jsonData));

    await promisify((cb) => processor.start(cb));

    const flags = await storeFacade.all(VersionedDataKinds.Features);
    expect(flags).toEqual(allData.flags);
    const segments = await storeFacade.all(VersionedDataKinds.Segments);
    expect(segments).toEqual(allData.segments);
  });
});

describe('given a polling processor with a short poll duration', () => {
  const requestor = {
    requestAllData: jest.fn()
  };
  const shortInterval = 0.1;
  const allData = { flags: { flag: { version: 1 } }, segments: { segment: { version: 1 } } };
  const jsonData = JSON.stringify(allData);

  let store: LDFeatureStore;
  let storeFacade: AsyncStoreFacade;
  let config: Configuration;
  let processor: PollingProcessor;


  beforeEach(() => {
    store = new InMemoryFeatureStore();
    storeFacade = new AsyncStoreFacade(store);
    config = new Configuration({
      featureStore: store,
      pollInterval: shortInterval,
      logger: new TestLogger()
    });
    // Configuration will not let us set this as low as needed for the test.
    Object.defineProperty(config, 'pollInterval', { value: 0.1 });
    processor = new PollingProcessor(config, requestor as unknown as Requestor);
  });

  afterEach(() => {
    processor.stop();
    jest.restoreAllMocks();
  });

  it('polls repeatedly', (done) => {
    requestor.requestAllData = jest.fn((cb) => cb(undefined, jsonData));

    processor.start(() => { });
    setTimeout(() => {
      expect(requestor.requestAllData.mock.calls.length).toBeGreaterThanOrEqual(4);
      done();
    }, 500);
  });

  it.each<number | jest.DoneCallback>([400, 408, 429, 500, 503])('continues polling after recoverable error', (status, done) => {
    requestor.requestAllData = jest.fn((cb) => cb({
      status
    }, undefined));
    processor.start((e) => {
      expect(e).toBeUndefined();
    });

    setTimeout(() => {
      expect(requestor.requestAllData.mock.calls.length).toBeGreaterThanOrEqual(2);
      const testLogger = config.logger as TestLogger;
      expect(testLogger.getCount(LogLevel.Error)).toBe(0);
      expect(testLogger.getCount(LogLevel.Warn)).toBeGreaterThan(2);
      (done as jest.DoneCallback)();
    }, 300);
  });

  it('continues polling after receiving invalid JSON', (done) => {
    requestor.requestAllData = jest.fn((cb) => cb(undefined, '{sad'));
    processor.start((e) => {
      expect(e).toBeDefined();
    });

    setTimeout(() => {
      expect(requestor.requestAllData.mock.calls.length).toBeGreaterThanOrEqual(2);
      const testLogger = config.logger as TestLogger;
      expect(testLogger.getCount(LogLevel.Error)).toBeGreaterThan(2);
      (done as jest.DoneCallback)();
    }, 300);
  });

  it.each<number | jest.DoneCallback>([401, 403])('does not continue after non-recoverable error', (status, done) => {
    requestor.requestAllData = jest.fn((cb) => cb({
      status
    }, undefined));
    processor.start((e) => {
      expect(e).toBeDefined();
    });

    setTimeout(() => {
      expect(requestor.requestAllData.mock.calls.length).toBe(1);
      const testLogger = config.logger as TestLogger;
      expect(testLogger.getCount(LogLevel.Error)).toBe(1);
      (done as jest.DoneCallback)();
    }, 300);
  });
});
