import { LDClientContext } from '@launchdarkly/node-server-sdk';

import MongoDBFeatureStoreFactory from '../src/MongoDBFeatureStoreFactory';
import MongoDBFeatureStore from '../src/MongoDBFeatureStore';

describe('MongoDBFeatureStoreFactory', () => {
  it('creates a feature store with provided options', () => {
    const options = {
      uri: 'mongodb://localhost:27017',
      database: 'test_db',
      prefix: 'test_',
      cacheTTL: 60,
    };

    const factory = MongoDBFeatureStoreFactory(options);
    expect(typeof factory).toBe('function');

    const mockContext: LDClientContext = {
      basicConfiguration: {
        logger: undefined,
      },
    } as any;

    const store = factory(mockContext);
    expect(store).toBeInstanceOf(MongoDBFeatureStore);
    
    store.close();
  });

  it('creates a feature store without options', () => {
    const factory = MongoDBFeatureStoreFactory();
    expect(typeof factory).toBe('function');

    const mockContext: LDClientContext = {
      basicConfiguration: {
        logger: undefined,
      },
    } as any;

    const store = factory(mockContext);
    expect(store).toBeInstanceOf(MongoDBFeatureStore);
    
    store.close();
  });

  it('passes logger from context to store', () => {
    const mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    const factory = MongoDBFeatureStoreFactory();
    const mockContext: LDClientContext = {
      basicConfiguration: {
        logger: mockLogger,
      },
    } as any;

    const store = factory(mockContext);
    expect(store).toBeInstanceOf(MongoDBFeatureStore);
    
    store.close();
  });

  it('uses custom cache TTL when provided', () => {
    const options = {
      cacheTTL: 120,
    };

    const factory = MongoDBFeatureStoreFactory(options);
    const mockContext: LDClientContext = {
      basicConfiguration: {
        logger: undefined,
      },
    } as any;

    const store = factory(mockContext);
    expect(store).toBeInstanceOf(MongoDBFeatureStore);
    
    store.close();
  });
});