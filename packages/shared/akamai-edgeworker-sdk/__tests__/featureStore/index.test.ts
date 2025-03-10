import { AsyncStoreFacade, LDFeatureStore } from '@launchdarkly/js-server-sdk-common';

import { EdgeFeatureStore, EdgeProvider } from '../../src/featureStore';
import * as testData from '../testData.json';

describe('EdgeFeatureStore', () => {
  const sdkKey = 'sdkKey';
  const kvKey = `LD-Env-${sdkKey}`;
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  const mockEdgeProvider: EdgeProvider = {
    get: jest.fn(),
  };
  const mockGet = mockEdgeProvider.get as jest.Mock;
  let featureStore: LDFeatureStore;
  let asyncFeatureStore: AsyncStoreFacade;

  beforeEach(() => {
    mockGet.mockImplementation(() => Promise.resolve(JSON.stringify(testData)));
    featureStore = new EdgeFeatureStore(
      mockEdgeProvider,
      sdkKey,
      'MockEdgeProvider',
      mockLogger,
      0,
    );
    asyncFeatureStore = new AsyncStoreFacade(featureStore);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('get', () => {
    it('get flag', async () => {
      const flag = await asyncFeatureStore.get({ namespace: 'features' }, 'testFlag1');
      expect(mockGet).toHaveBeenCalledWith(kvKey);
      expect(flag).toMatchObject(testData.flags.testFlag1);
    });
    it('invalid flag key', async () => {
      const flag = await asyncFeatureStore.get({ namespace: 'features' }, 'invalid');

      expect(flag).toBeUndefined();
    });

    it('get segment', async () => {
      const segment = await asyncFeatureStore.get({ namespace: 'segments' }, 'testSegment1');

      expect(mockGet).toHaveBeenCalledWith(kvKey);
      expect(segment).toMatchObject(testData.segments.testSegment1);
    });

    it('invalid segment key', async () => {
      const segment = await asyncFeatureStore.get({ namespace: 'segments' }, 'invalid');

      expect(segment).toBeUndefined();
    });

    it('invalid kv key', async () => {
      mockGet.mockImplementation(() => Promise.resolve(null));
      const flag = await asyncFeatureStore.get({ namespace: 'features' }, 'testFlag1');

      expect(flag).toBeNull();
    });
  });

  describe('all', () => {
    it('all flags', async () => {
      const flags = await asyncFeatureStore.all({ namespace: 'features' });

      expect(mockGet).toHaveBeenCalledWith(kvKey);
      expect(flags).toMatchObject(testData.flags);
    });

    it('all segments', async () => {
      const segment = await asyncFeatureStore.all({ namespace: 'segments' });

      expect(mockGet).toHaveBeenCalledWith(kvKey);
      expect(segment).toMatchObject(testData.segments);
    });

    it('invalid DataKind', async () => {
      const flag = await asyncFeatureStore.all({ namespace: 'InvalidDataKind' });

      expect(flag).toEqual({});
    });

    it('invalid kv key', async () => {
      mockGet.mockImplementation(() => Promise.resolve(null));
      const segment = await asyncFeatureStore.all({ namespace: 'segments' });

      expect(segment).toEqual({});
    });
  });

  describe('initialized', () => {
    it('is initialized', async () => {
      const isInitialized = await asyncFeatureStore.initialized();

      expect(mockGet).toHaveBeenCalledWith(kvKey);
      expect(isInitialized).toBeTruthy();
    });

    it('not initialized', async () => {
      mockGet.mockImplementation(() => Promise.resolve(null));
      const isInitialized = await asyncFeatureStore.initialized();

      expect(mockGet).toHaveBeenCalledWith(kvKey);
      expect(isInitialized).toBeFalsy();
    });
  });

  describe('init & getDescription', () => {
    it('init', (done) => {
      const cb = jest.fn(() => {
        done();
      });
      featureStore.init(testData, cb);
    });

    it('getDescription', async () => {
      const description = featureStore.getDescription?.();

      expect(description).toEqual('MockEdgeProvider');
    });
  });
});
