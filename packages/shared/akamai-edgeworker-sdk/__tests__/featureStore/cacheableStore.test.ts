import { EdgeProvider } from '../../src/featureStore';
import CacheableStoreProvider from '../../src/featureStore/cacheableStoreProvider';
import * as testData from '../testData.json';

describe('CacheableStoreProvider', () => {
  const mockEdgeProvider: EdgeProvider = {
    get: jest.fn(),
  };
  const mockGet = mockEdgeProvider.get as jest.Mock;

  beforeEach(() => {
    mockGet.mockImplementation(() => Promise.resolve(JSON.stringify(testData)));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('without cache TTL', () => {
    it('caches initial request', async () => {
      const cacheProvider = new CacheableStoreProvider(mockEdgeProvider, 'rootKey');
      await cacheProvider.get('rootKey');
      await cacheProvider.get('rootKey');
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('can force a refresh', async () => {
      const cacheProvider = new CacheableStoreProvider(mockEdgeProvider, 'rootKey');
      await cacheProvider.get('rootKey');
      await cacheProvider.get('rootKey');
      expect(mockGet).toHaveBeenCalledTimes(1);

      await cacheProvider.prefetchPayloadFromOriginStore();
      await cacheProvider.get('rootKey');
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('with infinite cache ttl', () => {
    it('caches initial request', async () => {
      const cacheProvider = new CacheableStoreProvider(mockEdgeProvider, 'rootKey', 0);
      await cacheProvider.get('rootKey');
      await cacheProvider.get('rootKey');
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('prefetch does not reset', async () => {
      const cacheProvider = new CacheableStoreProvider(mockEdgeProvider, 'rootKey', 0);
      await cacheProvider.get('rootKey');
      await cacheProvider.get('rootKey');
      expect(mockGet).toHaveBeenCalledTimes(1);

      await cacheProvider.prefetchPayloadFromOriginStore();
      await cacheProvider.get('rootKey');
      expect(mockGet).toHaveBeenCalledTimes(1);
    });
  });

  describe('with finite cache ttl', () => {
    it('caches initial request', async () => {
      const cacheProvider = new CacheableStoreProvider(mockEdgeProvider, 'rootKey', 50);
      await cacheProvider.get('rootKey');
      await cacheProvider.get('rootKey');
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('caches expires after duration', async () => {
      const cacheProvider = new CacheableStoreProvider(mockEdgeProvider, 'rootKey', 50);
      await cacheProvider.get('rootKey');
      await cacheProvider.get('rootKey');
      expect(mockGet).toHaveBeenCalledTimes(1);

      // eslint-disable-next-line no-promise-executor-return
      await new Promise((resolve) => setTimeout(resolve, 60));
      await cacheProvider.get('rootKey');
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it('prefetch respects cache TTL', async () => {
      const cacheProvider = new CacheableStoreProvider(mockEdgeProvider, 'rootKey', 50);
      await cacheProvider.get('rootKey');
      await cacheProvider.get('rootKey');
      expect(mockGet).toHaveBeenCalledTimes(1);

      await cacheProvider.prefetchPayloadFromOriginStore();
      await cacheProvider.get('rootKey');
      expect(mockGet).toHaveBeenCalledTimes(1);

      // eslint-disable-next-line no-promise-executor-return
      await new Promise((resolve) => setTimeout(resolve, 60));
      await cacheProvider.prefetchPayloadFromOriginStore();
      await cacheProvider.get('rootKey');
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });
});
