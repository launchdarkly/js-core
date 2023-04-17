import { AsyncStoreFacade, LDFeatureStore } from '@launchdarkly/js-server-sdk-common-edge';
import createFeatureStore from './createFeatureStore';

import mockKV from './utils/mockKV';
import * as testData from './utils/testData.json';

describe('createFeatureStore', () => {
  const sdkKey = 'sdkKey';
  const kvKey = `LD-Env-${sdkKey}`;
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  const mockGet = mockKV.get as jest.Mock;
  let featureStore: LDFeatureStore;
  let asyncFeatureStore: AsyncStoreFacade;

  beforeEach(() => {
    mockGet.mockImplementation(() => Promise.resolve(testData));
    featureStore = createFeatureStore(mockKV, sdkKey, mockLogger);
    asyncFeatureStore = new AsyncStoreFacade(featureStore);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('get', () => {
    test('get flag', async () => {
      const flag = await asyncFeatureStore.get({ namespace: 'features' }, 'testFlag1');

      expect(mockGet).toHaveBeenCalledWith(kvKey, { type: 'json' });
      expect(flag).toEqual(testData.flags.testFlag1);
    });

    test('invalid flag key', async () => {
      const flag = await asyncFeatureStore.get({ namespace: 'features' }, 'invalid');

      expect(flag).toBeUndefined();
    });

    test('get segment', async () => {
      const segment = await asyncFeatureStore.get({ namespace: 'segments' }, 'testSegment1');

      expect(mockGet).toHaveBeenCalledWith(kvKey, { type: 'json' });
      expect(segment).toEqual(testData.segments.testSegment1);
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

      expect(mockGet).toHaveBeenCalledWith(kvKey, { type: 'json' });
      expect(flag).toEqual(testData.flags);
    });

    test('all segments', async () => {
      const segment = await asyncFeatureStore.all({ namespace: 'segments' });

      expect(mockGet).toHaveBeenCalledWith(kvKey, { type: 'json' });
      expect(segment).toEqual(testData.segments);
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

      expect(mockGet).toHaveBeenCalledWith(kvKey);
      expect(isInitialized).toBeTruthy();
    });

    test('not initialized', async () => {
      mockGet.mockImplementation(() => Promise.resolve(null));
      const isInitialized = await asyncFeatureStore.initialized();

      expect(mockGet).toHaveBeenCalledWith(kvKey);
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

      expect(description).toEqual('Cloudflare');
    });
  });
});
