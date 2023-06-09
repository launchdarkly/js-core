import { AsyncStoreFacade } from '@launchdarkly/node-server-sdk';
import DynamoDBFeatureStore from '../src/DynamoDBFeatureStore';
import clearPrefix from './clearPrefix';
import setupTable from './setupTable';
import LDDynamoDBOptions from '../src/LDDynamoDBOptions';

const dataKind = {
  features: { namespace: 'features' },
  segments: { namespace: 'segments' },
};

const DEFAULT_CLIENT_OPTIONS: LDDynamoDBOptions = {
  clientOptions: {
    endpoint: 'http://localhost:8000',
    region: 'us-west-2',
    credentials: { accessKeyId: 'fake', secretAccessKey: 'fake' },
  }
}


describe.each([['test-table-1', undefined], ['test-table-2', 'testing']])('given an empty store', (table, prefixParam) => {
  let store: DynamoDBFeatureStore;
  let facade: AsyncStoreFacade;

  beforeEach(async () => {
    await setupTable(table, DEFAULT_CLIENT_OPTIONS.clientOptions!);
    await clearPrefix(table, prefixParam);
    store = new DynamoDBFeatureStore(table, { ...DEFAULT_CLIENT_OPTIONS, prefix: prefixParam }, undefined);
    facade = new AsyncStoreFacade(store);
  });

  afterEach(() => {
    store.close();
  });

  it(`is initialized after calling init() ${table}-${prefixParam}`, async () => {
    await facade.init({});
    const initialized = await facade.initialized();
    expect(initialized).toBeTruthy();
  });

  it(`completely replaces previous data when calling init() ${table}-${prefixParam}`, async () => {
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
});

describe.each([['test-table-1', undefined], ['test-table-2', 'testing']])('given an empty store', (table, prefixParam) => {
  let store: DynamoDBFeatureStore;
  let facade: AsyncStoreFacade;

  const feature1 = { key: 'foo', version: 10 };
  const feature2 = { key: 'bar', version: 10 };
  beforeEach(async () => {
    await setupTable(table, DEFAULT_CLIENT_OPTIONS.clientOptions!);
    await clearPrefix(table, prefixParam);
    store = new DynamoDBFeatureStore(table, { ...DEFAULT_CLIENT_OPTIONS, prefix: prefixParam }, undefined);
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
    // so their transactions will be interleaved unless we're correctly serializing updates
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
});
