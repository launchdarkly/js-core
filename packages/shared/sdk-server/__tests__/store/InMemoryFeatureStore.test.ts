import AsyncStoreFacade from '../../src/store/AsyncStoreFacade';
import InMemoryFeatureStore from '../../src/store/InMemoryFeatureStore';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';

// To simplify testing the memory store will be wrapped with the async facade.
// Writing the tests with callbacks would make them much more difficult to follow.

describe('given an empty feature store and async facade', () => {
  const store = new AsyncStoreFacade(new InMemoryFeatureStore());

  it('can be initialized', async () => {
    await store.init({});
    const initialized = await store.initialized();
    expect(initialized).toBeTruthy();
  });
});

describe('given an initialized feature store', () => {
  let featureStore: AsyncStoreFacade;
  const feature1 = { key: 'foo', version: 10 };
  const feature2 = { key: 'bar', version: 10 };

  beforeEach(async () => {
    featureStore = new AsyncStoreFacade(new InMemoryFeatureStore());
    return featureStore.init({
      [VersionedDataKinds.Features.namespace]: {
        foo: feature1,
        bar: feature2,
      },
      [VersionedDataKinds.Segments.namespace]: {},
    });
  });

  it('gets an existing feature', async () => {
    const feature = await featureStore.get(VersionedDataKinds.Features, 'foo');
    expect(feature).toStrictEqual(feature1);
  });

  it('gets null for a feature that does not exist', async () => {
    const feature = await featureStore.get(VersionedDataKinds.Features, 'unknown');
    expect(feature).toBeNull();
  });

  it('gets all features', async () => {
    const features = await featureStore.all(VersionedDataKinds.Features);
    expect(features).toStrictEqual({
      foo: feature1,
      bar: feature2,
    });
  });

  it('does not upsert an older version', async () => {
    await featureStore.upsert(VersionedDataKinds.Features, {
      ...feature1,
      version: feature1.version - 1,
    });
    const feature = await featureStore.get(VersionedDataKinds.Features, 'foo');
    expect(feature).toEqual(feature1);
  });

  it('does upsert a newer version', async () => {
    const updatedFeature = {
      ...feature1,
      version: feature1.version + 1,
    };
    await featureStore.upsert(VersionedDataKinds.Features, updatedFeature);
    const feature = await featureStore.get(VersionedDataKinds.Features, 'foo');
    expect(feature).toEqual(updatedFeature);
  });

  it('does upsert a new feature', async () => {
    const newFeature = {
      key: 'new-feature',
      version: feature1.version + 1,
    };
    await featureStore.upsert(VersionedDataKinds.Features, newFeature);
    const feature = await featureStore.get(VersionedDataKinds.Features, newFeature.key);
    expect(feature).toEqual(newFeature);
  });

  it('handles race conditions in upserts', async () => {
    const ver1 = { key: feature1.key, version: feature1.version + 1 };
    const ver2 = { key: feature1.key, version: feature1.version + 2 };

    // Intentionally not awaiting these.
    const p1 = featureStore.upsert(VersionedDataKinds.Features, ver1);
    const p2 = featureStore.upsert(VersionedDataKinds.Features, ver2);

    // Let them both finish.
    await Promise.all([p2, p1]);

    const feature = await featureStore.get(VersionedDataKinds.Features, feature1.key);
    expect(feature).toEqual(ver2);
  });

  it('deletes with newer version', async () => {
    featureStore.delete(VersionedDataKinds.Features, feature1.key, feature1.version + 1);
    const feature = await featureStore.get(VersionedDataKinds.Features, feature1.key);
    expect(feature).toBeNull();
  });

  it('does not delete with older version', async () => {
    featureStore.delete(VersionedDataKinds.Features, feature1.key, feature1.version - 1);
    const feature = await featureStore.get(VersionedDataKinds.Features, feature1.key);
    expect(feature).toStrictEqual(feature1);
  });

  it('allows deleting an unknown feature', async () => {
    featureStore.delete(VersionedDataKinds.Features, 'unknown', 10);
    const feature = await featureStore.get(VersionedDataKinds.Features, 'unknown');
    expect(feature).toBeNull();
  });

  it('does not upsert older version after delete', async () => {
    const key = 'featureKey';
    featureStore.delete(VersionedDataKinds.Features, key, 10);

    featureStore.upsert(VersionedDataKinds.Features, {
      key,
      version: 9,
    });
    const feature = await featureStore.get(VersionedDataKinds.Features, key);
    expect(feature).toBeNull();
  });

  it('does upsert newer version after delete', async () => {
    const key = 'featureKey';
    featureStore.delete(VersionedDataKinds.Features, key, 10);

    featureStore.upsert(VersionedDataKinds.Features, {
      key,
      version: 11,
    });
    const feature = await featureStore.get(VersionedDataKinds.Features, key);
    expect(feature).toStrictEqual({
      key,
      version: 11,
    });
  });

  it('does upsert a new item of unknown kind', async () => {
    const newPotato = {
      key: 'new-feature',
      version: 1,
    };
    await featureStore.upsert({ namespace: 'potato' }, newPotato);
    const feature = await featureStore.get({ namespace: 'potato' }, newPotato.key);
    expect(feature).toEqual(newPotato);
  });

  it('returns undefined initMetadata', () => {
    expect(featureStore.getInitMetadata?.()).toBeUndefined();
  });
});

describe('given an initialized feature store with metadata', () => {
  let featureStore: AsyncStoreFacade;

  beforeEach(async () => {
    featureStore = new AsyncStoreFacade(new InMemoryFeatureStore());
    await featureStore.init({}, { environmentId: '12345' });
  });

  it('returns correct metadata', () => {
    expect(featureStore.getInitMetadata?.()).toEqual({ environmentId: '12345' });
  });
});
