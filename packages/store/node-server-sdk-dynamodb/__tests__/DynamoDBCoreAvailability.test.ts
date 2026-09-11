import { interfaces, PersistentDataStoreWrapper } from '@launchdarkly/node-server-sdk';

import DynamoDBCore from '../src/DynamoDBCore';
import DynamoDBFeatureStore from '../src/DynamoDBFeatureStore';

jest.mock('@launchdarkly/node-server-sdk', () => {
  const actual = jest.requireActual('@launchdarkly/node-server-sdk');
  return {
    ...actual,
    PersistentDataStoreWrapper: jest.fn(),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

const featuresKind: interfaces.PersistentStoreDataKind = {
  namespace: 'features',
  deserialize: (data: string) => JSON.parse(data),
};

const allData: interfaces.KindKeyedStore<interfaces.PersistentStoreDataKind> = [
  {
    key: featuresKind,
    item: [{ key: 'flagA', item: { version: 1, deleted: false, serializedItem: '{"version":1}' } }],
  },
];

it('reports an init error through the callback when the batch write fails', (done) => {
  const state = {
    prefixedKey: (key: string) => key,
    query: jest.fn().mockResolvedValue([]),
    batchWrite: jest.fn().mockRejectedValue(new Error('write failed')),
  };
  // @ts-ignore Partial state mock for testing.
  const core = new DynamoDBCore('test-table', state);
  core.init(allData, (err) => {
    expect(err).toEqual(new Error('write failed'));
    done();
  });
});

it('reports an init error through the callback when reading existing items fails', (done) => {
  const state = {
    prefixedKey: (key: string) => key,
    query: jest.fn().mockRejectedValue(new Error('read failed')),
    batchWrite: jest.fn(),
  };
  // @ts-ignore Partial state mock for testing.
  const core = new DynamoDBCore('test-table', state);
  core.init(allData, (err) => {
    expect(err).toEqual(new Error('read failed'));
    expect(state.batchWrite).not.toHaveBeenCalled();
    done();
  });
});

it('calls back without an error when init succeeds', (done) => {
  const state = {
    prefixedKey: (key: string) => key,
    query: jest.fn().mockResolvedValue([]),
    batchWrite: jest.fn().mockResolvedValue(undefined),
  };
  // @ts-ignore Partial state mock for testing.
  const core = new DynamoDBCore('test-table', state);
  core.init(allData, (err) => {
    expect(err).toBeUndefined();
    done();
  });
});

it('calls back true from isStoreAvailable when the read succeeds', (done) => {
  const state = {
    prefixedKey: (key: string) => key,
    get: jest.fn().mockResolvedValue(undefined),
  };
  // @ts-ignore Partial state mock for testing.
  const core = new DynamoDBCore('test-table', state);
  core.isStoreAvailable((isAvailable) => {
    expect(isAvailable).toBe(true);
    done();
  });
});

it('calls back false from isStoreAvailable when the read fails', (done) => {
  const state = {
    prefixedKey: (key: string) => key,
    get: jest.fn().mockRejectedValue(new Error('connection failed')),
  };
  // @ts-ignore Partial state mock for testing.
  const core = new DynamoDBCore('test-table', state);
  core.isStoreAvailable((isAvailable) => {
    expect(isAvailable).toBe(false);
    done();
  });
});

it('does not reject its returned promise when the isStoreAvailable callback throws', async () => {
  const state = {
    prefixedKey: (key: string) => key,
    get: jest.fn().mockResolvedValue(undefined),
  };
  // @ts-ignore Partial state mock for testing.
  const core = new DynamoDBCore('test-table', state);
  await expect(
    core.isStoreAvailable(() => {
      throw new Error('callback exploded');
    }),
  ).resolves.toBeUndefined();
});

it('forwards isStoreAvailable through the feature store facade', (done) => {
  (PersistentDataStoreWrapper as unknown as jest.Mock).mockImplementation(() => ({
    isStoreAvailable: (callback: (isAvailable: boolean) => void) => callback(true),
  }));
  const store = new DynamoDBFeatureStore('test-table');
  store.isStoreAvailable((isAvailable) => {
    expect(isAvailable).toBe(true);
    done();
  });
});
