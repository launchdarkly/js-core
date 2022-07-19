import { LDFeatureStore } from '../../src/api/subsystems';
import promisify from '../../src/async/promisify';
import PollingProcessor from '../../src/data_sources/PollingProcessor';
import Requestor from '../../src/data_sources/Requestor';
import Configuration from '../../src/options/Configuration';
import AsyncStoreFacade from '../../src/store/AsyncStoreFacade';
import InMemoryFeatureStore from '../../src/store/InMemoryFeatureStore';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';
import TestLogger from '../Logger';

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
    processor.start(() => {});

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
    processor = new PollingProcessor(config, requestor as unknown as Requestor);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    processor.stop();
  });

  it('polls repeatedly', (done) => {
    requestor.requestAllData = jest.fn((cb) => cb(undefined, jsonData));

    processor.start(() => {});
    setTimeout(() => {
      expect(requestor.requestAllData.mock.calls.length).toBeGreaterThanOrEqual(4);
      done();
    }, 500);
  });
});