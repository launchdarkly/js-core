import { LDClientContext } from '@launchdarkly/node-server-sdk';

import MongoDBBigSegmentStoreFactory from '../src/MongoDBBigSegmentStoreFactory';
import MongoDBBigSegmentStore from '../src/MongoDBBigSegmentStore';

describe('MongoDBBigSegmentStoreFactory', () => {
  it('creates a store with provided options', () => {
    const options = {
      uri: 'mongodb://localhost:27017',
      database: 'test_db',
      prefix: 'test_',
    };

    const factory = MongoDBBigSegmentStoreFactory(options);
    expect(typeof factory).toBe('function');

    const mockContext: LDClientContext = {
      basicConfiguration: {
        logger: undefined,
      },
    } as any;

    const store = factory(mockContext);
    expect(store).toBeInstanceOf(MongoDBBigSegmentStore);
    
    store.close();
  });

  it('creates a store without options', () => {
    const factory = MongoDBBigSegmentStoreFactory();
    expect(typeof factory).toBe('function');

    const mockContext: LDClientContext = {
      basicConfiguration: {
        logger: undefined,
      },
    } as any;

    const store = factory(mockContext);
    expect(store).toBeInstanceOf(MongoDBBigSegmentStore);
    
    store.close();
  });

  it('passes logger from context to store', () => {
    const mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    const factory = MongoDBBigSegmentStoreFactory();
    const mockContext: LDClientContext = {
      basicConfiguration: {
        logger: mockLogger,
      },
    } as any;

    const store = factory(mockContext);
    expect(store).toBeInstanceOf(MongoDBBigSegmentStore);
    
    store.close();
  });
});