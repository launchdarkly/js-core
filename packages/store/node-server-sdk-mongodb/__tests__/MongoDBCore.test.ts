import { interfaces } from '@launchdarkly/node-server-sdk';

import MongoDBCore, {
  COLLECTION_FEATURES,
  COLLECTION_SEGMENTS,
  COLLECTION_INITIALIZED,
  INITIALIZED_TOKEN,
} from '../src/MongoDBCore';
import MongoDBClientState from '../src/MongoDBClientState';

const mockDataKind: interfaces.PersistentStoreDataKind = {
  namespace: 'test_namespace',
  deserialize: (str: string) => JSON.parse(str),
};

describe('MongoDBCore', () => {
  let core: MongoDBCore;
  let clientState: MongoDBClientState;

  beforeEach(() => {
    clientState = new MongoDBClientState({
      uri: 'mongodb://localhost:27017',
      database: 'test_mongodb_core',
    });
    core = new MongoDBCore(clientState);
  });

  afterEach(() => {
    core.close();
  });

  describe('initialization', () => {
    it('sets initialized flag after init', (done) => {
      core.init([], () => {
        core.initialized((isInit) => {
          expect(isInit).toBe(true);
          done();
        });
      });
    });

    it('returns false for initialized before init', (done) => {
      core.initialized((isInit) => {
        expect(isInit).toBe(false);
        done();
      });
    });
  });

  describe('data operations', () => {
    const testItem: interfaces.SerializedItemDescriptor = {
      version: 1,
      serializedItem: '{"key":"test","enabled":true}',
    };

    beforeEach((done) => {
      // Initialize empty store
      core.init([], done);
    });

    it('stores and retrieves items', (done) => {
      core.upsert(mockDataKind, 'test_key', testItem, (err, result) => {
        expect(err).toBeUndefined();
        expect(result).toEqual(testItem);

        core.get(mockDataKind, 'test_key', (retrieved) => {
          expect(retrieved).toEqual(testItem);
          done();
        });
      });
    });

    it('returns undefined for non-existent items', (done) => {
      core.get(mockDataKind, 'nonexistent', (result) => {
        expect(result).toBeUndefined();
        done();
      });
    });

    it('handles deleted items', (done) => {
      const deletedItem: interfaces.SerializedItemDescriptor = {
        version: 2,
        deleted: true,
      };

      core.upsert(mockDataKind, 'test_key', deletedItem, (err, result) => {
        expect(err).toBeUndefined();
        expect(result).toEqual(deletedItem);

        core.get(mockDataKind, 'test_key', (retrieved) => {
          expect(retrieved?.deleted).toBe(true);
          expect(retrieved?.version).toBe(2);
          done();
        });
      });
    });

    it('respects version ordering for upserts', (done) => {
      // First, insert item with version 2
      const newerItem: interfaces.SerializedItemDescriptor = {
        version: 2,
        serializedItem: '{"key":"test","version":2}',
      };

      core.upsert(mockDataKind, 'test_key', newerItem, () => {
        // Try to upsert with older version 1
        const olderItem: interfaces.SerializedItemDescriptor = {
          version: 1,
          serializedItem: '{"key":"test","version":1}',
        };

        core.upsert(mockDataKind, 'test_key', olderItem, () => {
          // Should still have the newer version
          core.get(mockDataKind, 'test_key', (retrieved) => {
            expect(retrieved?.version).toBe(2);
            expect(retrieved?.serializedItem).toBe('{"key":"test","version":2}');
            done();
          });
        });
      });
    });

    it('retrieves all items of a kind', (done) => {
      const item1: interfaces.SerializedItemDescriptor = {
        version: 1,
        serializedItem: '{"key":"item1"}',
      };
      const item2: interfaces.SerializedItemDescriptor = {
        version: 1,
        serializedItem: '{"key":"item2"}',
      };

      core.upsert(mockDataKind, 'key1', item1, () => {
        core.upsert(mockDataKind, 'key2', item2, () => {
          core.getAll(mockDataKind, (results) => {
            expect(results).toBeDefined();
            expect(results!.length).toBe(2);

            const resultMap = new Map(results!.map(r => [r.key, r.item]));
            expect(resultMap.get('key1')).toEqual(item1);
            expect(resultMap.get('key2')).toEqual(item2);
            done();
          });
        });
      });
    });

    it('excludes deleted items from getAll', (done) => {
      const normalItem: interfaces.SerializedItemDescriptor = {
        version: 1,
        serializedItem: '{"key":"normal"}',
      };
      const deletedItem: interfaces.SerializedItemDescriptor = {
        version: 1,
        deleted: true,
      };

      core.upsert(mockDataKind, 'normal', normalItem, () => {
        core.upsert(mockDataKind, 'deleted', deletedItem, () => {
          core.getAll(mockDataKind, (results) => {
            expect(results).toBeDefined();
            expect(results!.length).toBe(1);
            expect(results![0].key).toBe('normal');
            expect(results![0].item).toEqual(normalItem);
            done();
          });
        });
      });
    });
  });

  describe('error handling', () => {
    it('handles database connection errors gracefully', (done) => {
      const badCore = new MongoDBCore(
        new MongoDBClientState({
          uri: 'mongodb://nonexistent:27017',
          connectTimeoutMS: 100,
          maxRetries: 0,
        })
      );

      badCore.get(mockDataKind, 'test', (result) => {
        expect(result).toBeUndefined();
        badCore.close();
        done();
      });
    });
  });

  describe('constants', () => {
    it('exports expected collection names', () => {
      expect(COLLECTION_FEATURES).toBe('features');
      expect(COLLECTION_SEGMENTS).toBe('segments');
      expect(COLLECTION_INITIALIZED).toBe('initialized');
      expect(INITIALIZED_TOKEN).toBe('$inited');
    });
  });

  describe('description', () => {
    it('returns MongoDB as description', () => {
      expect(core.getDescription()).toBe('MongoDB');
    });
  });
});
