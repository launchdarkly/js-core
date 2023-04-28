import { AsyncStoreFacade, LDFeatureStore } from '@launchdarkly/js-server-sdk-common-edge';
import VercelFeatureStore from './vercelFeatureStore';

import mockEdge from './utils/mockEdge';
import * as testData from './utils/testData.json';

describe('VercelFeatureStore', () => {
  const sdkKey = 'sdkKey';
  const configKey = `LD-Env-${sdkKey}`;
  const {
    testFlag1: { debugEventsUntilDate: d1, ...testFlag1Subset },
    testFlag2: { debugEventsUntilDate: d2, ...testFlag2Subset },
    testFlag3: { debugEventsUntilDate: d3, ...testFlag3Subset },
  } = testData.flags;
  const testDataFlagsSubset = {
    testFlag1: testFlag1Subset,
    testFlag2: testFlag2Subset,
    testFlag3: testFlag3Subset,
  };
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  const mockGet = mockEdge.get as jest.Mock;
  let featureStore: LDFeatureStore;
  let asyncFeatureStore: AsyncStoreFacade;

  beforeEach(() => {
    // Vercel Edge can't return simple strings
    mockGet.mockImplementation(() => Promise.resolve(testData));
    featureStore = new VercelFeatureStore(mockEdge, sdkKey, mockLogger);
    asyncFeatureStore = new AsyncStoreFacade(featureStore);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('get', () => {
    test('get flag', async () => {
      const flag = await asyncFeatureStore.get({ namespace: 'features' }, 'testFlag1');

      expect(mockGet).toHaveBeenCalledWith(configKey);
      expect(flag).toMatchObject(testFlag1Subset);
    });

    test('invalid flag key', async () => {
      const flag = await asyncFeatureStore.get({ namespace: 'features' }, 'invalid');

      expect(flag).toBeUndefined();
    });

    test('get segment', async () => {
      const segment = await asyncFeatureStore.get({ namespace: 'segments' }, 'testSegment1');

      expect(mockGet).toHaveBeenCalledWith(configKey);
      expect(segment).toMatchObject(testData.segments.testSegment1);
    });

    test('invalid segment key', async () => {
      const segment = await asyncFeatureStore.get({ namespace: 'segments' }, 'invalid');

      expect(segment).toBeUndefined();
    });

    test('invalid kv key', async () => {
      mockGet.mockImplementation(() => Promise.resolve(null));
      const flag = await asyncFeatureStore.get({ namespace: 'features' }, 'testFlag1');

      expect(flag).toBeNull();
    });
  });

  describe('all', () => {
    test('all flags', async () => {
      const flag = await asyncFeatureStore.all({ namespace: 'features' });

      expect(mockGet).toHaveBeenCalledWith(configKey);
      expect(flag).toMatchObject(testDataFlagsSubset);
    });

    test('all segments', async () => {
      const segment = await asyncFeatureStore.all({ namespace: 'segments' });

      expect(mockGet).toHaveBeenCalledWith(configKey);
      expect(segment).toMatchObject(testData.segments);
    });

    test('invalid DataKind', async () => {
      const flag = await asyncFeatureStore.all({ namespace: 'InvalidDataKind' });

      expect(flag).toBeUndefined();
    });

    test('invalid kv key', async () => {
      mockGet.mockImplementation(() => Promise.resolve(null));
      const segment = await asyncFeatureStore.all({ namespace: 'segments' });

      expect(segment).toEqual({});
    });
  });

  describe('initialized', () => {
    test('is initialized', async () => {
      const isInitialized = await asyncFeatureStore.initialized();

      expect(mockGet).toHaveBeenCalledWith(configKey);
      expect(isInitialized).toBeTruthy();
    });

    test('not initialized', async () => {
      mockGet.mockImplementation(() => Promise.resolve(null));
      const isInitialized = await asyncFeatureStore.initialized();

      expect(mockGet).toHaveBeenCalledWith(configKey);
      expect(isInitialized).toBeFalsy();
    });
  });

  describe('init & getDescription', () => {
    test('init', (done) => {
      const cb = jest.fn(() => {
        done();
      });
      featureStore.init(testData, cb);
    });

    test('getDescription', async () => {
      const description = featureStore.getDescription?.();

      expect(description).toEqual('Vercel Edge Config');
    });
  });
});
