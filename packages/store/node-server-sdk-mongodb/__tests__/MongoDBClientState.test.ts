import MongoDBClientState from '../src/MongoDBClientState';

describe('MongoDBClientState', () => {
  let clientState: MongoDBClientState;

  afterEach(() => {
    if (clientState) {
      clientState.close();
    }
  });

  describe('collection naming', () => {
    it('returns collection name without prefix when no prefix is set', () => {
      clientState = new MongoDBClientState();
      expect(clientState.prefixedCollection('test')).toBe('test');
    });

    it('returns prefixed collection name when prefix is set', () => {
      clientState = new MongoDBClientState({ prefix: 'myapp_' });
      expect(clientState.prefixedCollection('test')).toBe('myapp_test');
    });

    it('handles empty prefix', () => {
      clientState = new MongoDBClientState({ prefix: '' });
      expect(clientState.prefixedCollection('test')).toBe('test');
    });
  });

  describe('connection management', () => {
    it('can be closed safely when not connected', () => {
      clientState = new MongoDBClientState();
      expect(() => clientState.close()).not.toThrow();
    });

    it('connects to MongoDB with default settings', async () => {
      clientState = new MongoDBClientState();
      const db = await clientState.getDatabase();
      expect(db).toBeDefined();
      expect(db.databaseName).toBe('launchdarkly');
    });

    it('connects to MongoDB with custom settings', async () => {
      clientState = new MongoDBClientState({
        uri: 'mongodb://localhost:27017',
        database: 'test_custom_db',
      });
      const db = await clientState.getDatabase();
      expect(db).toBeDefined();
      expect(db.databaseName).toBe('test_custom_db');
    });

    it('reuses existing connection', async () => {
      clientState = new MongoDBClientState();
      const db1 = await clientState.getDatabase();
      const db2 = await clientState.getDatabase();
      expect(db1).toBe(db2);
    });

    it('gets collection from database', async () => {
      clientState = new MongoDBClientState({
        database: 'test_collection_db',
      });
      const collection = await clientState.getCollection('test_collection');
      expect(collection).toBeDefined();
      expect(collection.collectionName).toBe('test_collection');
    });

    it('gets prefixed collection from database', async () => {
      clientState = new MongoDBClientState({
        database: 'test_collection_db',
        prefix: 'prefix_',
      });
      const collection = await clientState.getCollection('test_collection');
      expect(collection).toBeDefined();
      expect(collection.collectionName).toBe('prefix_test_collection');
    });
  });

  describe('error handling', () => {
    it('throws error when connection fails', async () => {
      clientState = new MongoDBClientState({
        uri: 'mongodb://nonexistent:27017',
        connectTimeoutMS: 100,
        maxRetries: 0,
      });

      await expect(clientState.getDatabase()).rejects.toThrow();
    });

    it('retries connection on failure', async () => {
      clientState = new MongoDBClientState({
        uri: 'mongodb://nonexistent:27017',
        connectTimeoutMS: 100,
        maxRetries: 2,
        retryDelayMS: 50,
      });

      const startTime = Date.now();
      await expect(clientState.getDatabase()).rejects.toThrow();
      const endTime = Date.now();
      
      // Should have retried at least twice with delays
      expect(endTime - startTime).toBeGreaterThan(100);
    }, 10000);
  });

  describe('configuration options', () => {
    it('uses default values when options not provided', () => {
      clientState = new MongoDBClientState();
      expect(clientState.prefixedCollection('test')).toBe('test');
    });

    it('applies custom retry settings', async () => {
      clientState = new MongoDBClientState({
        uri: 'mongodb://nonexistent:27017',
        connectTimeoutMS: 50,
        maxRetries: 1,
        retryDelayMS: 25,
      });

      const startTime = Date.now();
      await expect(clientState.getDatabase()).rejects.toThrow();
      const endTime = Date.now();
      
      // Should fail faster with custom settings
      expect(endTime - startTime).toBeLessThan(500);
    }, 5000);
  });
});