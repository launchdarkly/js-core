import { AsyncStoreFacade, LDFeatureStore } from '@launchdarkly/js-server-sdk-common-edge';
import VercelFeatureStore from './vercelFeatureStore';

import mockEdge from './utils/mockEdge';
import * as testData from './utils/testData.json';

describe('VercelFeatureStore', () => {
  const sdkKey = 'sdkKey';
  const configKey = `LD-Env-${sdkKey}`;
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
      expect(flag).toEqual(testData.flags.testFlag1);
    });

    test('invalid flag key', async () => {
      const flag = await asyncFeatureStore.get({ namespace: 'features' }, 'invalid');

      expect(flag).toBeUndefined();
    });

    test('invalid edge config key', async () => {
      mockGet.mockImplementation(() => Promise.resolve(null));
      const flag = await asyncFeatureStore.get({ namespace: 'features' }, 'testFlag1');

      expect(flag).toBeNull();
    });
  });

  describe('all', () => {
    test('all flags', async () => {
      const flag = await asyncFeatureStore.all({ namespace: 'features' });

      expect(mockGet).toHaveBeenCalledWith(configKey);
      expect(flag).toEqual(testData.flags);
    });

    test('invalid DataKind', async () => {
      const flag = await asyncFeatureStore.all({ namespace: 'InvalidDataKind' });

      expect(flag).toBeUndefined();
    });

    test('invalid edge config key', async () => {
      mockGet.mockImplementation(() => Promise.resolve(null));
      const flag = await asyncFeatureStore.all({ namespace: 'flags11' });

      expect(flag).toEqual({});
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
