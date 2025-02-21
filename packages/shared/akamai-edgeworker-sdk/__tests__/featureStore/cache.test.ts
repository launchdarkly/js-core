import { AsyncStoreFacade, LDFeatureStore } from '@launchdarkly/js-server-sdk-common';

import { EdgeFeatureStore, EdgeProvider } from '../../src/featureStore';
import * as testData from '../testData.json';

describe('EdgeFeatureStore', () => {
  const sdkKey = 'sdkKey';
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

  describe('with infinite cache', () => {
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

    it('will cache the initial request', async () => {
      await asyncFeatureStore.get({ namespace: 'features' }, 'testFlag1');
      await asyncFeatureStore.get({ namespace: 'features' }, 'testFlag1');
      await asyncFeatureStore.all({ namespace: 'features' });

      expect(mockGet).toHaveBeenCalledTimes(1);
    });
  });

  describe('with cache disabled', () => {
    beforeEach(() => {
      mockGet.mockImplementation(() => Promise.resolve(JSON.stringify(testData)));
      featureStore = new EdgeFeatureStore(
        mockEdgeProvider,
        sdkKey,
        'MockEdgeProvider',
        mockLogger,
        -1,
      );
      asyncFeatureStore = new AsyncStoreFacade(featureStore);
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('caches nothing', async () => {
      await asyncFeatureStore.get({ namespace: 'features' }, 'testFlag1');
      await asyncFeatureStore.get({ namespace: 'features' }, 'testFlag1');
      await asyncFeatureStore.all({ namespace: 'features' });

      expect(mockGet).toHaveBeenCalledTimes(3);
    });
  });

  describe('with finite cache', () => {
    beforeEach(() => {
      mockGet.mockImplementation(() => Promise.resolve(JSON.stringify(testData)));
      featureStore = new EdgeFeatureStore(
        mockEdgeProvider,
        sdkKey,
        'MockEdgeProvider',
        mockLogger,
        100,
      );
      asyncFeatureStore = new AsyncStoreFacade(featureStore);
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('expires are configured duration', async () => {
      jest.spyOn(Date, 'now').mockImplementation(() => 0);
      await asyncFeatureStore.get({ namespace: 'features' }, 'testFlag1');
      await asyncFeatureStore.get({ namespace: 'features' }, 'testFlag1');
      await asyncFeatureStore.all({ namespace: 'features' });

      expect(mockGet).toHaveBeenCalledTimes(1);

      jest.spyOn(Date, 'now').mockImplementation(() => 99);
      await asyncFeatureStore.get({ namespace: 'features' }, 'testFlag1');
      await asyncFeatureStore.get({ namespace: 'features' }, 'testFlag1');
      await asyncFeatureStore.all({ namespace: 'features' });

      expect(mockGet).toHaveBeenCalledTimes(1);

      jest.spyOn(Date, 'now').mockImplementation(() => 100);
      await asyncFeatureStore.get({ namespace: 'features' }, 'testFlag1');
      await asyncFeatureStore.get({ namespace: 'features' }, 'testFlag1');
      await asyncFeatureStore.all({ namespace: 'features' });

      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });
});
