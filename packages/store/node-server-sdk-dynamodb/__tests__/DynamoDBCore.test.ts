import { interfaces } from '@launchdarkly/node-server-sdk';

import DynamoDBClientState from '../src/DynamoDBClientState';
import DynamoDBCore, { calculateSize } from '../src/DynamoDBCore';
import LDDynamoDBOptions from '../src/LDDynamoDBOptions';
import clearPrefix from './clearPrefix';
import setupTable from './setupTable';

const DEFAULT_TABLE_NAME = 'test-table';

const featuresKind = { namespace: 'features', deserialize: (data: string) => JSON.parse(data) };
const segmentsKind = { namespace: 'segments', deserialize: (data: string) => JSON.parse(data) };

const dataKind = {
  features: featuresKind,
  segments: segmentsKind,
};

const DEFAULT_CLIENT_OPTIONS: LDDynamoDBOptions = {
  clientOptions: {
    endpoint: 'http://localhost:8000',
    region: 'us-west-2',
    credentials: { accessKeyId: 'fake', secretAccessKey: 'fake' },
  },
};

function promisify<T>(method: (callback: (val: T) => void) => void): Promise<T> {
  return new Promise<T>((resolve) => {
    method((val: T) => {
      resolve(val);
    });
  });
}

type UpsertResult = {
  err: Error | undefined;
  updatedDescriptor: interfaces.SerializedItemDescriptor | undefined;
};

class AsyncCoreFacade {
  constructor(private readonly _core: DynamoDBCore) {}

  init(allData: interfaces.KindKeyedStore<interfaces.PersistentStoreDataKind>): Promise<void> {
    return promisify<void>((cb) => this._core.init(allData, () => cb()));
  }

  get(
    kind: interfaces.PersistentStoreDataKind,
    key: string,
  ): Promise<interfaces.SerializedItemDescriptor | undefined> {
    return promisify((cb) => this._core.get(kind, key, cb));
  }

  getAll(
    kind: interfaces.PersistentStoreDataKind,
  ): Promise<interfaces.KeyedItem<string, interfaces.SerializedItemDescriptor>[] | undefined> {
    return promisify((cb) => this._core.getAll(kind, cb));
  }

  upsert(
    kind: interfaces.PersistentStoreDataKind,
    key: string,
    descriptor: interfaces.SerializedItemDescriptor,
  ): Promise<UpsertResult> {
    return new Promise<UpsertResult>((resolve) => {
      this._core.upsert(kind, key, descriptor, (err, updatedDescriptor) => {
        resolve({ err, updatedDescriptor });
      });
    });
  }

  initialized(): Promise<boolean> {
    return promisify((cb) => this._core.initialized(cb));
  }

  close(): void {
    this._core.close();
  }

  getDescription(): string {
    return this._core.getDescription();
  }
}

describe('given an empty store', () => {
  let core: DynamoDBCore;
  let facade: AsyncCoreFacade;

  beforeEach(async () => {
    await setupTable(DEFAULT_TABLE_NAME, DEFAULT_CLIENT_OPTIONS.clientOptions!);
    await clearPrefix(DEFAULT_TABLE_NAME, 'launchdarkly');
    core = new DynamoDBCore(
      DEFAULT_TABLE_NAME,
      new DynamoDBClientState(DEFAULT_CLIENT_OPTIONS),
      undefined,
    );
    facade = new AsyncCoreFacade(core);
  });

  afterEach(() => {
    core.close();
  });

  it('is initialized after calling init()', async () => {
    await facade.init([]);
    const initialized = await facade.initialized();
    expect(initialized).toBeTruthy();
  });

  it('completely replaces previous data when calling init()', async () => {
    const flags = [
      { key: 'first', item: { version: 1, serializedItem: `{"version":1}`, deleted: false } },
      { key: 'second', item: { version: 1, serializedItem: `{"version":1}`, deleted: false } },
    ];
    const segments = [
      { key: 'first', item: { version: 2, serializedItem: `{"version":2}`, deleted: false } },
    ];

    await facade.init([
      { key: dataKind.features, item: flags },
      { key: dataKind.segments, item: segments },
    ]);

    const items1 = await facade.getAll(dataKind.features);
    const items2 = await facade.getAll(dataKind.segments);

    // Reading from the store will not maintain the version.
    expect(items1).toEqual([
      {
        key: 'first',
        item: { version: 1, deleted: false, serializedItem: '{"version":1}' },
      },
      {
        key: 'second',
        item: { version: 1, deleted: false, serializedItem: '{"version":1}' },
      },
    ]);
    expect(items2).toEqual([
      {
        key: 'first',
        item: { version: 2, deleted: false, serializedItem: '{"version":2}' },
      },
    ]);

    const newFlags = [
      { key: 'first', item: { version: 2, serializedItem: `{"version":2}`, deleted: false } },
    ];
    const newSegments = [
      { key: 'first', item: { version: 3, serializedItem: `{"version":3}`, deleted: false } },
    ];

    await facade.init([
      { key: dataKind.features, item: newFlags },
      { key: dataKind.segments, item: newSegments },
    ]);

    const items3 = await facade.getAll(dataKind.features);
    const items4 = await facade.getAll(dataKind.segments);

    expect(items3).toEqual([
      {
        key: 'first',
        item: { version: 2, deleted: false, serializedItem: '{"version":2}' },
      },
    ]);
    expect(items4).toEqual([
      {
        key: 'first',
        item: { version: 3, deleted: false, serializedItem: '{"version":3}' },
      },
    ]);
  });

  it('does not write the initialized token when the batch write fails', async () => {
    const mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const state = new DynamoDBClientState(DEFAULT_CLIENT_OPTIONS);
    const errorCore = new DynamoDBCore(DEFAULT_TABLE_NAME, state, mockLogger);
    const errorFacade = new AsyncCoreFacade(errorCore);

    const putSpy = jest.spyOn(state, 'put');
    const error = new Error('write failed');
    jest.spyOn(state, 'batchWrite').mockRejectedValueOnce(error);

    await errorFacade.init([]);

    // The token write must not happen when the data batch fails.
    expect(putSpy).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(`Error writing to DynamoDB: ${error}`);

    errorCore.close();
  });

  it('writes the initialized token only after the data batch succeeds', async () => {
    const flags = [
      { key: 'first', item: { version: 1, serializedItem: `{"version":1}`, deleted: false } },
    ];

    const state = new DynamoDBClientState(DEFAULT_CLIENT_OPTIONS);
    const successCore = new DynamoDBCore(DEFAULT_TABLE_NAME, state, undefined);
    const successFacade = new AsyncCoreFacade(successCore);

    const batchWriteSpy = jest.spyOn(state, 'batchWrite');
    const putSpy = jest.spyOn(state, 'put');

    await successFacade.init([{ key: dataKind.features, item: flags }]);

    // The data batch must not include the token.
    const [, ops] = batchWriteSpy.mock.calls[0];
    expect(
      ops.some(
        (op) =>
          op.PutRequest?.Item?.namespace.S === '$inited' &&
          op.PutRequest?.Item?.key.S === '$inited',
      ),
    ).toBe(false);

    // The token is written on its own, after the data batch succeeds.
    expect(putSpy).toHaveBeenCalledWith({
      TableName: DEFAULT_TABLE_NAME,
      Item: { namespace: { S: '$inited' }, key: { S: '$inited' } },
    });
    expect(batchWriteSpy.mock.invocationCallOrder[0]).toBeLessThan(
      putSpy.mock.invocationCallOrder[0],
    );

    successCore.close();
  });

  it('writes the initialized token even when there is no data to batch', async () => {
    const state = new DynamoDBClientState(DEFAULT_CLIENT_OPTIONS);
    const emptyCore = new DynamoDBCore(DEFAULT_TABLE_NAME, state, undefined);
    const emptyFacade = new AsyncCoreFacade(emptyCore);

    const batchWriteSpy = jest.spyOn(state, 'batchWrite');
    const putSpy = jest.spyOn(state, 'put');

    await emptyFacade.init([]);

    expect(batchWriteSpy).toHaveBeenCalledWith(DEFAULT_TABLE_NAME, []);
    expect(putSpy).toHaveBeenCalledWith({
      TableName: DEFAULT_TABLE_NAME,
      Item: { namespace: { S: '$inited' }, key: { S: '$inited' } },
    });

    emptyCore.close();
  });

  it('removes the initialized token before writing data when reinitializing', async () => {
    const flags = [
      { key: 'first', item: { version: 1, serializedItem: `{"version":1}`, deleted: false } },
    ];

    const state = new DynamoDBClientState(DEFAULT_CLIENT_OPTIONS);
    const reinitCore = new DynamoDBCore(DEFAULT_TABLE_NAME, state, undefined);
    const reinitFacade = new AsyncCoreFacade(reinitCore);

    // The first initialization writes the token.
    await reinitFacade.init([{ key: dataKind.features, item: flags }]);

    const deleteSpy = jest.spyOn(state, 'delete');
    const batchWriteSpy = jest.spyOn(state, 'batchWrite');
    const putSpy = jest.spyOn(state, 'put');

    await reinitFacade.init([{ key: dataKind.features, item: flags }]);

    // The order is: remove the token, write the data batch, write the token.
    expect(deleteSpy).toHaveBeenCalledWith(DEFAULT_TABLE_NAME, {
      namespace: { S: '$inited' },
      key: { S: '$inited' },
    });
    expect(deleteSpy.mock.invocationCallOrder[0]).toBeLessThan(
      batchWriteSpy.mock.invocationCallOrder[0],
    );
    expect(batchWriteSpy.mock.invocationCallOrder[0]).toBeLessThan(
      putSpy.mock.invocationCallOrder[0],
    );

    // A healthy reinitialization ends with the store initialized.
    const initialized = await reinitFacade.initialized();
    expect(initialized).toBe(true);

    reinitCore.close();
  });

  it('reports not initialized after a failed reinitialization', async () => {
    const flags = [
      { key: 'first', item: { version: 1, serializedItem: `{"version":1}`, deleted: false } },
    ];

    const state = new DynamoDBClientState(DEFAULT_CLIENT_OPTIONS);
    const reinitCore = new DynamoDBCore(DEFAULT_TABLE_NAME, state, undefined);
    const reinitFacade = new AsyncCoreFacade(reinitCore);

    // The first initialization succeeds and writes the token.
    await reinitFacade.init([{ key: dataKind.features, item: flags }]);
    const before = await reinitFacade.initialized();
    expect(before).toBe(true);

    // The token delete calls through to the store. Only the data batch fails.
    const error = new Error('reinit batch failed');
    jest.spyOn(state, 'batchWrite').mockRejectedValueOnce(error);

    await reinitFacade.init([{ key: dataKind.features, item: flags }]);

    // The failed replacement must not present the store as initialized.
    const after = await reinitFacade.initialized();
    expect(after).toBe(false);

    reinitCore.close();
  });

  it('reports an error and writes no data when the token delete fails', async () => {
    const mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const state = new DynamoDBClientState(DEFAULT_CLIENT_OPTIONS);
    const errorCore = new DynamoDBCore(DEFAULT_TABLE_NAME, state, mockLogger);

    const batchWriteSpy = jest.spyOn(state, 'batchWrite');
    const putSpy = jest.spyOn(state, 'put');
    const error = new Error('delete failed');
    jest.spyOn(state, 'delete').mockRejectedValueOnce(error);

    const reportedError = await new Promise<Error | undefined>((resolve) => {
      errorCore.init([], resolve);
    });

    expect(reportedError).toBe(error);
    expect(batchWriteSpy).not.toHaveBeenCalled();
    expect(putSpy).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(`Error writing to DynamoDB: ${error}`);

    errorCore.close();
  });

  it('initializes when there is no existing initialized token', async () => {
    const state = new DynamoDBClientState(DEFAULT_CLIENT_OPTIONS);
    const firstInitCore = new DynamoDBCore(DEFAULT_TABLE_NAME, state, undefined);
    const firstInitFacade = new AsyncCoreFacade(firstInitCore);

    // Make sure the table has no token, so the init-time delete targets a
    // missing key. DynamoDB treats that delete as a successful no-op.
    await state.delete(DEFAULT_TABLE_NAME, {
      namespace: { S: '$inited' },
      key: { S: '$inited' },
    });

    const deleteSpy = jest.spyOn(state, 'delete');

    await firstInitFacade.init([]);

    expect(deleteSpy).toHaveBeenCalledTimes(1);
    const initialized = await firstInitFacade.initialized();
    expect(initialized).toBe(true);

    firstInitCore.close();
  });
});

describe('given a store with basic data', () => {
  let core: DynamoDBCore;
  let facade: AsyncCoreFacade;

  const feature1 = { key: 'foo', version: 10 };
  const feature2 = { key: 'bar', version: 10 };

  beforeEach(async () => {
    await clearPrefix(DEFAULT_TABLE_NAME, 'launchdarkly');
    core = new DynamoDBCore(
      DEFAULT_TABLE_NAME,
      new DynamoDBClientState(DEFAULT_CLIENT_OPTIONS),
      undefined,
    );
    const flags = [
      {
        key: 'foo',
        item: { version: 10, serializedItem: JSON.stringify(feature1), deleted: false },
      },
      {
        key: 'bar',
        item: { version: 10, serializedItem: JSON.stringify(feature2), deleted: false },
      },
    ];
    const segments: interfaces.KeyedItem<string, interfaces.SerializedItemDescriptor>[] = [];

    facade = new AsyncCoreFacade(core);

    await facade.init([
      { key: dataKind.features, item: flags },
      { key: dataKind.segments, item: segments },
    ]);
  });

  afterEach(() => {
    core.close();
  });

  it('gets a feature that exists', async () => {
    const result = await facade.get(dataKind.features, feature1.key);
    expect(result).toEqual({
      version: 10,
      deleted: false,
      serializedItem: JSON.stringify(feature1),
    });
  });

  it('does not get nonexisting feature', async () => {
    const result = await facade.get(dataKind.features, 'biz');
    expect(result).toBeUndefined();
  });

  it('gets all features', async () => {
    const result = await facade.getAll(dataKind.features);
    expect(result).toEqual(
      expect.arrayContaining([
        {
          key: 'foo',
          item: { version: 10, serializedItem: JSON.stringify(feature1), deleted: false },
        },
        {
          key: 'bar',
          item: { version: 10, serializedItem: JSON.stringify(feature2), deleted: false },
        },
      ]),
    );
  });

  it('upserts with newer version', async () => {
    const newVer = { key: feature1.key, version: feature1.version + 1 };
    const descriptor = {
      version: newVer.version,
      deleted: false,
      serializedItem: JSON.stringify(newVer),
    };

    await facade.upsert(dataKind.features, newVer.key, descriptor);
    const result = await facade.get(dataKind.features, feature1.key);
    expect(result).toEqual(descriptor);
  });

  it('does not upsert with older version', async () => {
    const oldVer = { key: feature1.key, version: feature1.version - 1 };
    const descriptor = {
      version: oldVer.version,
      deleted: false,
      serializedItem: JSON.stringify(oldVer),
    };
    await facade.upsert(dataKind.features, oldVer.key, descriptor);
    const result = await facade.get(dataKind.features, feature1.key);
    expect(result).toEqual({
      version: 10,
      deleted: false,
      serializedItem: `{"key":"foo","version":10}`,
    });
  });

  it('upserts new feature', async () => {
    const newFeature = { key: 'biz', version: 99 };
    const descriptor = {
      version: newFeature.version,
      deleted: false,
      serializedItem: JSON.stringify(newFeature),
    };
    await facade.upsert(dataKind.features, newFeature.key, descriptor);
    const result = await facade.get(dataKind.features, newFeature.key);
    expect(result).toEqual(descriptor);
  });

  it('handles batchWrite error during init', async () => {
    const mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const state = new DynamoDBClientState(DEFAULT_CLIENT_OPTIONS);
    const errorCore = new DynamoDBCore(DEFAULT_TABLE_NAME, state, mockLogger);
    const errorFacade = new AsyncCoreFacade(errorCore);

    // Mock batchWrite to throw an error
    const error = new Error('Batch write failed');
    jest.spyOn(state, 'batchWrite').mockRejectedValueOnce(error);

    // Should not throw, but should complete the callback
    await expect(errorFacade.init([])).resolves.not.toThrow();

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(`Error writing to DynamoDB: ${error}`);
  });

  it('handles get error', async () => {
    const mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const state = new DynamoDBClientState(DEFAULT_CLIENT_OPTIONS);
    const errorCore = new DynamoDBCore(DEFAULT_TABLE_NAME, state, mockLogger);
    const errorFacade = new AsyncCoreFacade(errorCore);

    // Mock get to throw an error
    const error = new Error('Get failed');
    jest.spyOn(state, 'get').mockRejectedValueOnce(error);

    // Should return undefined when get fails
    const result = await errorFacade.get(dataKind.features, 'some-key');
    expect(result).toBeUndefined();

    // Verify error was logged with correct namespace and key
    expect(mockLogger.error).toHaveBeenCalledWith(`Error reading features:some-key: ${error}`);
  });
});

it('it can calculate size', () => {
  const stringPayload = `{"key":"foo","version":10}`;

  expect(
    calculateSize({
      test: { S: stringPayload },
    }),
  ).toEqual(100 + 'test'.length + stringPayload.length);

  expect(
    calculateSize({
      test: { N: '14' },
    }),
  ).toEqual(100 + 'test'.length + 2);

  expect(
    calculateSize({
      test: { BOOL: true },
    }),
  ).toEqual(100 + 'test'.length + 1);

  expect(
    calculateSize({
      bool: { BOOL: true },
      string: { S: stringPayload },
      number: { N: '14' },
    }),
  ).toEqual(100 + 'test'.length + 'string'.length + 'number'.length + stringPayload.length + 2 + 1);
});
