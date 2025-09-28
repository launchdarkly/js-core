import { AsyncStoreFacade } from '@launchdarkly/node-server-sdk';
import { MongoClient } from 'mongodb';

import MongoDBFeatureStore from '../src/MongoDBFeatureStore';

const dataKind = {
  features: { namespace: 'features' },
  segments: { namespace: 'segments' },
};

const TEST_DATABASE = 'test_launchdarkly_feature_store';

// Helper function to clear all test data
async function clearTestData(prefix?: string): Promise<void> {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db(TEST_DATABASE);

  const collections = ['features', 'segments', 'initialized'];

  for (const collectionName of collections) {
    const actualCollectionName = prefix ? `${prefix}${collectionName}` : collectionName;
    await db.collection(actualCollectionName).deleteMany({});
  }

  await client.close();
}

describe.each([undefined, 'testing_'])('MongoDB Feature Store', (prefixParam) => {
  const prefix = prefixParam || '';

  describe('given an empty store', () => {
    let store: MongoDBFeatureStore;
    let facade: AsyncStoreFacade;

    beforeEach(async () => {
      await clearTestData(prefixParam);
      store = new MongoDBFeatureStore({
        uri: 'mongodb://localhost:27017',
        database: TEST_DATABASE,
        prefix: prefixParam,
      });
      facade = new AsyncStoreFacade(store);
    });

    afterEach(() => {
      store.close();
    });

    it('is initialized after calling init()', async () => {
      await facade.init({});
      const initialized = await facade.initialized();
      expect(initialized).toBeTruthy();
    });

    it('is not initialized before calling init()', async () => {
      const initialized = await facade.initialized();
      expect(initialized).toBeFalsy();
    });

    it('completely replaces previous data when calling init()', async () => {
      const flags = {
        first: { key: 'first', version: 1 },
        second: { key: 'second', version: 1 },
      };
      const segments = { first: { key: 'first', version: 2 } };
      const initData1 = {
        features: flags,
        segments,
      };

      await facade.init(initData1);
      const items1 = await facade.all(dataKind.features);
      expect(items1).toEqual(flags);
      const items2 = await facade.all(dataKind.segments);
      expect(items2).toEqual(segments);

      const newFlags = { first: { key: 'first', version: 3 } };
      const newSegments = { first: { key: 'first', version: 4 } };
      const initData2 = {
        features: newFlags,
        segments: newSegments,
      };

      await facade.init(initData2);
      const items3 = await facade.all(dataKind.features);
      expect(items3).toEqual(newFlags);
      const items4 = await facade.all(dataKind.segments);
      expect(items4).toEqual(newSegments);
    });

    it('removes previous data that is not in new init data', async () => {
      // Initialize with some data
      const initialData = {
        features: {
          flag1: { key: 'flag1', version: 1 },
          flag2: { key: 'flag2', version: 1 },
        },
        segments: {},
      };
      await facade.init(initialData);

      // Verify initial data is there
      const result1 = await facade.get(dataKind.features, 'flag1');
      expect(result1).toEqual({ key: 'flag1', version: 1 });

      // Re-initialize with different data
      const newData = {
        features: {
          flag3: { key: 'flag3', version: 1 },
        },
        segments: {},
      };
      await facade.init(newData);

      // Old data should be gone
      const result2 = await facade.get(dataKind.features, 'flag1');
      expect(result2).toBeNull();
      const result3 = await facade.get(dataKind.features, 'flag2');
      expect(result3).toBeNull();

      // New data should be there
      const result4 = await facade.get(dataKind.features, 'flag3');
      expect(result4).toEqual({ key: 'flag3', version: 1 });
    });
  });

  describe('given a store with basic data', () => {
    let store: MongoDBFeatureStore;
    let facade: AsyncStoreFacade;

    const feature1 = { key: 'foo', version: 10 };
    const feature2 = { key: 'bar', version: 10 };

    beforeEach(async () => {
      await clearTestData(prefixParam);
      store = new MongoDBFeatureStore({
        uri: 'mongodb://localhost:27017',
        database: TEST_DATABASE,
        prefix: prefixParam,
      });
      facade = new AsyncStoreFacade(store);
      await facade.init({
        features: {
          foo: feature1,
          bar: feature2,
        },
        segments: {},
      });
    });

    afterEach(() => {
      store.close();
    });

    it('gets a feature that exists', async () => {
      const result = await facade.get(dataKind.features, feature1.key);
      expect(result).toEqual(feature1);
    });

    it('does not get nonexisting feature', async () => {
      const result = await facade.get(dataKind.features, 'biz');
      expect(result).toBeNull();
    });

    it('gets all features', async () => {
      const result = await facade.all(dataKind.features);
      expect(result).toEqual({
        foo: feature1,
        bar: feature2,
      });
    });

    it('gets empty collection when no segments exist', async () => {
      const result = await facade.all(dataKind.segments);
      expect(result).toEqual({});
    });

    it('upserts with newer version', async () => {
      const newVer = { key: feature1.key, version: feature1.version + 1 };

      await facade.upsert(dataKind.features, newVer);
      const result = await facade.get(dataKind.features, feature1.key);
      expect(result).toEqual(newVer);
    });

    it('does not upsert with older version', async () => {
      const oldVer = { key: feature1.key, version: feature1.version - 1 };
      await facade.upsert(dataKind.features, oldVer);
      const result = await facade.get(dataKind.features, feature1.key);
      expect(result).toEqual(feature1);
    });

    it('upserts new feature', async () => {
      const newFeature = { key: 'biz', version: 99 };
      await facade.upsert(dataKind.features, newFeature);
      const result = await facade.get(dataKind.features, newFeature.key);
      expect(result).toEqual(newFeature);
    });

    it('handles upsert race condition within same client correctly', async () => {
      const ver1 = { key: feature1.key, version: feature1.version + 1 };
      const ver2 = { key: feature1.key, version: feature1.version + 2 };
      const promises: Promise<any>[] = [];

      // Deliberately do not wait for the first upsert to complete before starting the second,
      // so their operations will be interleaved unless we're correctly handling version conflicts
      promises.push(facade.upsert(dataKind.features, ver2));
      promises.push(facade.upsert(dataKind.features, ver1));

      // Now wait until both have completed
      await Promise.all(promises);
      const result = await facade.get(dataKind.features, feature1.key);
      expect(result).toEqual(ver2);
    });

    it('deletes with newer version', async () => {
      await facade.delete(dataKind.features, feature1.key, feature1.version + 1);
      const result = await facade.get(dataKind.features, feature1.key);
      expect(result).toBe(null);
    });

    it('does not delete with older version', async () => {
      await facade.delete(dataKind.features, feature1.key, feature1.version - 1);
      const result = await facade.get(dataKind.features, feature1.key);
      expect(result).not.toBe(null);
    });

    it('allows deleting unknown feature', async () => {
      await facade.delete(dataKind.features, 'biz', 99);
      const result = await facade.get(dataKind.features, 'biz');
      expect(result).toBe(null);
    });

    it('does not upsert older version after delete', async () => {
      await facade.delete(dataKind.features, feature1.key, feature1.version + 1);
      await facade.upsert(dataKind.features, feature1);
      const result = await facade.get(dataKind.features, feature1.key);
      expect(result).toBe(null);
    });

    it('handles concurrent upserts to different keys', async () => {
      const newFeature1 = { key: 'concurrent1', version: 1 };
      const newFeature2 = { key: 'concurrent2', version: 1 };

      const promises = [
        facade.upsert(dataKind.features, newFeature1),
        facade.upsert(dataKind.features, newFeature2),
      ];

      await Promise.all(promises);

      const result1 = await facade.get(dataKind.features, 'concurrent1');
      const result2 = await facade.get(dataKind.features, 'concurrent2');

      expect(result1).toEqual(newFeature1);
      expect(result2).toEqual(newFeature2);
    });
  });

  describe('error handling', () => {
    it('handles connection errors gracefully', async () => {
      const store = new MongoDBFeatureStore({
        uri: 'mongodb://nonexistent:27017',
        database: TEST_DATABASE,
        connectTimeoutMS: 100,
        maxRetries: 0,
      });
      const facade = new AsyncStoreFacade(store);

      const result = await facade.get(dataKind.features, 'nonexistent');
      expect(result).toBeNull();

      store.close();
    });
  });

  describe('cache behavior', () => {
    let store: MongoDBFeatureStore;
    let facade: AsyncStoreFacade;

    beforeEach(async () => {
      await clearTestData(prefixParam);
      store = new MongoDBFeatureStore({
        uri: 'mongodb://localhost:27017',
        database: TEST_DATABASE,
        prefix: prefixParam,
        cacheTTL: 1, // Very short cache for testing
      });
      facade = new AsyncStoreFacade(store);
    });

    afterEach(() => {
      store.close();
    });

    it('respects cache TTL setting', async () => {
      const feature = { key: 'cached_feature', version: 1 };

      await facade.init({
        features: { cached_feature: feature },
        segments: {},
      });

      // First get should populate cache
      const result1 = await facade.get(dataKind.features, 'cached_feature');
      expect(result1).toEqual(feature);

      // Wait for cache to expire (1 second + small buffer)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should still work after cache expiry
      const result2 = await facade.get(dataKind.features, 'cached_feature');
      expect(result2).toEqual(feature);
    });
  });
});
