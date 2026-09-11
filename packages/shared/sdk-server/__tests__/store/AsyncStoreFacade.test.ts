import { LDTransactionalFeatureStore } from '../../src/api/subsystems';
import AsyncStoreFacade from '../../src/store/AsyncStoreFacade';
import AsyncTransactionalStoreFacade from '../../src/store/AsyncTransactionalStoreFacade';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';

function makeErroringStore(): LDTransactionalFeatureStore {
  return {
    get: (_kind, _key, callback) => callback(null),
    all: (_kind, callback) => callback({}),
    init: (_allData, callback) => callback(new Error('init failed')),
    // A store can forward an error at runtime even though the declared delete
    // callback has no parameters, because delete is implemented as an upsert.
    delete: (_kind, _key, _version, callback) =>
      (callback as (err?: Error) => void)(new Error('delete failed')),
    upsert: (_kind, _data, callback) => callback(new Error('upsert failed')),
    applyChanges: (_basis, _data, callback) => callback(),
    initialized: (callback) => callback(true),
    close: () => {},
    getDescription: () => 'erroring store',
  };
}

it('resolves init to undefined when the store reports an error', async () => {
  const facade = new AsyncStoreFacade(makeErroringStore());
  await expect(facade.init({})).resolves.toBeUndefined();
});

it('resolves upsert to undefined when the store reports an error', async () => {
  const facade = new AsyncStoreFacade(makeErroringStore());
  await expect(
    facade.upsert(VersionedDataKinds.Features, { key: 'flagA', version: 1 }),
  ).resolves.toBeUndefined();
});

it('resolves delete to undefined when the store reports an error', async () => {
  const facade = new AsyncStoreFacade(makeErroringStore());
  await expect(facade.delete(VersionedDataKinds.Features, 'flagA', 2)).resolves.toBeUndefined();
});

it('resolves transactional init to undefined when the store reports an error', async () => {
  const facade = new AsyncTransactionalStoreFacade(makeErroringStore());
  await expect(facade.init({})).resolves.toBeUndefined();
});

it('resolves transactional upsert to undefined when the store reports an error', async () => {
  const facade = new AsyncTransactionalStoreFacade(makeErroringStore());
  await expect(
    facade.upsert(VersionedDataKinds.Features, { key: 'flagA', version: 1 }),
  ).resolves.toBeUndefined();
});

it('resolves transactional delete to undefined when the store reports an error', async () => {
  const facade = new AsyncTransactionalStoreFacade(makeErroringStore());
  await expect(facade.delete(VersionedDataKinds.Features, 'flagA', 2)).resolves.toBeUndefined();
});
