import { MongoClient, Db, Collection } from 'mongodb';

import { interfaces } from '@launchdarkly/node-server-sdk';

import MongoDBBigSegmentStore, {
  COLLECTION_BIG_SEGMENTS_METADATA,
  COLLECTION_BIG_SEGMENTS_USER,
  METADATA_KEY,
  FIELD_LAST_UP_TO_DATE,
  FIELD_USER_HASH,
  FIELD_INCLUDED,
  FIELD_EXCLUDED,
} from '../src/MongoDBBigSegmentStore';

const FAKE_HASH = 'userhash';
const TEST_DATABASE = 'test_launchdarkly';

// Helper function to clear all test data
async function clearTestData(prefix?: string): Promise<void> {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db(TEST_DATABASE);
  
  const metadataCollectionName = prefix ? `${prefix}${COLLECTION_BIG_SEGMENTS_METADATA}` : COLLECTION_BIG_SEGMENTS_METADATA;
  const userCollectionName = prefix ? `${prefix}${COLLECTION_BIG_SEGMENTS_USER}` : COLLECTION_BIG_SEGMENTS_USER;
  
  await db.collection(metadataCollectionName).deleteMany({});
  await db.collection(userCollectionName).deleteMany({});
  await client.close();
}

// Helper function to set metadata in the database
async function setMetadata(
  prefix: string,
  metadata: interfaces.BigSegmentStoreMetadata,
): Promise<void> {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db(TEST_DATABASE);
  
  const metadataCollectionName = prefix ? `${prefix}${COLLECTION_BIG_SEGMENTS_METADATA}` : COLLECTION_BIG_SEGMENTS_METADATA;
  const metadataCollection = db.collection(metadataCollectionName);
  
  if (metadata.lastUpToDate) {
    await metadataCollection.replaceOne(
      { _id: METADATA_KEY },
      { _id: METADATA_KEY, [FIELD_LAST_UP_TO_DATE]: metadata.lastUpToDate },
      { upsert: true }
    );
  }
  
  await client.close();
}

// Helper function to set user segment membership in the database
async function setSegments(
  prefix: string,
  userHashKey: string,
  included: string[],
  excluded: string[],
): Promise<void> {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db(TEST_DATABASE);
  
  const userCollectionName = prefix ? `${prefix}${COLLECTION_BIG_SEGMENTS_USER}` : COLLECTION_BIG_SEGMENTS_USER;
  const userCollection = db.collection(userCollectionName);
  
  const userData: any = { [FIELD_USER_HASH]: userHashKey };
  
  if (included.length > 0) {
    userData[FIELD_INCLUDED] = included;
  }
  
  if (excluded.length > 0) {
    userData[FIELD_EXCLUDED] = excluded;
  }
  
  await userCollection.replaceOne(
    { [FIELD_USER_HASH]: userHashKey },
    userData,
    { upsert: true }
  );
  
  await client.close();
}

describe.each([undefined, 'app1_'])('MongoDB big segment store', (prefixParam) => {
  let store: MongoDBBigSegmentStore;
  const prefix = prefixParam || '';

  beforeEach(async () => {
    await clearTestData(prefixParam);
    store = new MongoDBBigSegmentStore({
      uri: 'mongodb://localhost:27017',
      database: TEST_DATABASE,
      prefix: prefixParam,
    });
  });

  afterEach(async () => {
    store.close();
  });

  describe('metadata operations', () => {
    it('can get populated metadata', async () => {
      const expected = { lastUpToDate: 1234567890 };
      await setMetadata(prefix, expected);
      const meta = await store.getMetadata();
      expect(meta).toEqual(expected);
    });

    it('can get metadata when not populated', async () => {
      const meta = await store.getMetadata();
      expect(meta?.lastUpToDate).toBeUndefined();
    });

    it('returns empty object when metadata collection is empty', async () => {
      const meta = await store.getMetadata();
      expect(meta).toEqual({});
    });
  });

  describe('user membership operations', () => {
    it('can get user membership for a user which has no membership', async () => {
      const membership = await store.getUserMembership(FAKE_HASH);
      expect(membership).toBeUndefined();
    });

    it('can get membership for a user that is only included', async () => {
      await setSegments(prefix, FAKE_HASH, ['key1', 'key2'], []);

      const membership = await store.getUserMembership(FAKE_HASH);
      expect(membership).toEqual({ key1: true, key2: true });
    });

    it('can get membership for a user that is only excluded', async () => {
      await setSegments(prefix, FAKE_HASH, [], ['key1', 'key2']);

      const membership = await store.getUserMembership(FAKE_HASH);
      expect(membership).toEqual({ key1: false, key2: false });
    });

    it('can get membership for a user that is included and excluded', async () => {
      await setSegments(prefix, FAKE_HASH, ['key1', 'key2'], ['key2', 'key3']);

      const membership = await store.getUserMembership(FAKE_HASH);
      expect(membership).toEqual({ key1: true, key2: true, key3: false }); // include of key2 overrides exclude
    });

    it('returns undefined when user exists but has no segments', async () => {
      // Create a user document without included/excluded fields
      const client = new MongoClient('mongodb://localhost:27017');
      await client.connect();
      const db = client.db(TEST_DATABASE);
      
      const userCollectionName = prefix ? `${prefix}${COLLECTION_BIG_SEGMENTS_USER}` : COLLECTION_BIG_SEGMENTS_USER;
      const userCollection = db.collection(userCollectionName);
      
      await userCollection.insertOne({ [FIELD_USER_HASH]: FAKE_HASH });
      await client.close();

      const membership = await store.getUserMembership(FAKE_HASH);
      expect(membership).toBeUndefined();
    });

    it('handles empty arrays in included and excluded fields', async () => {
      await setSegments(prefix, FAKE_HASH, [], []);

      const membership = await store.getUserMembership(FAKE_HASH);
      expect(membership).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('throws error when MongoDB is unavailable for getMetadata', async () => {
      const storeWithBadUri = new MongoDBBigSegmentStore({
        uri: 'mongodb://nonexistent:27017',
        database: TEST_DATABASE,
        connectTimeoutMS: 100,
        maxRetries: 0,
      });

      await expect(storeWithBadUri.getMetadata()).rejects.toThrow();
      storeWithBadUri.close();
    });

    it('throws error when MongoDB is unavailable for getUserMembership', async () => {
      const storeWithBadUri = new MongoDBBigSegmentStore({
        uri: 'mongodb://nonexistent:27017',
        database: TEST_DATABASE,
        connectTimeoutMS: 100,
        maxRetries: 0,
      });

      await expect(storeWithBadUri.getUserMembership(FAKE_HASH)).rejects.toThrow();
      storeWithBadUri.close();
    });
  });

  describe('connection management', () => {
    it('can be closed safely multiple times', () => {
      expect(() => {
        store.close();
        store.close();
      }).not.toThrow();
    });

    it('reconnects automatically after connection loss', async () => {
      // First, verify the store works
      const meta1 = await store.getMetadata();
      expect(meta1).toEqual({});

      // Close the connection
      store.close();

      // Should reconnect on next operation
      const meta2 = await store.getMetadata();
      expect(meta2).toEqual({});
    });
  });

  describe('configuration options', () => {
    it('uses default URI when none provided', async () => {
      const defaultStore = new MongoDBBigSegmentStore({
        database: TEST_DATABASE,
      });

      // Should work with default localhost URI
      const meta = await defaultStore.getMetadata();
      expect(meta).toEqual({});
      
      defaultStore.close();
    });

    it('uses default database when none provided', async () => {
      const defaultDbStore = new MongoDBBigSegmentStore({
        uri: 'mongodb://localhost:27017',
      });

      // This will use the default 'launchdarkly' database
      const meta = await defaultDbStore.getMetadata();
      expect(meta).toEqual({});
      
      defaultDbStore.close();
    });
  });
});