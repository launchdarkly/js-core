/* eslint-disable no-underscore-dangle */
import { OverrideLayer, ReadStoreOverlay } from '../../src/overrides';
import AsyncStoreFacade from '../../src/store/AsyncStoreFacade';
import InMemoryFeatureStore from '../../src/store/InMemoryFeatureStore';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';
import { singleValueFlag } from './overridesTestSupport';

function promiseGet(overlay: ReadStoreOverlay, namespace: 'features' | 'segments', key: string) {
  const kind = namespace === 'features' ? VersionedDataKinds.Features : VersionedDataKinds.Segments;
  return new Promise<any>((resolve) => {
    overlay.get(kind, key, resolve);
  });
}

function promiseAll(overlay: ReadStoreOverlay) {
  return new Promise<any>((resolve) => {
    overlay.all(VersionedDataKinds.Features, resolve);
  });
}

function promiseInitialized(overlay: ReadStoreOverlay) {
  return new Promise<boolean>((resolve) => {
    overlay.initialized(resolve);
  });
}

describe('given an initialized base store with flags', () => {
  let base: InMemoryFeatureStore;
  let layer: OverrideLayer;
  let overlay: ReadStoreOverlay;

  beforeEach(async () => {
    base = new InMemoryFeatureStore();
    await new AsyncStoreFacade(base).init({
      features: {
        both: singleValueFlag('both', 'base', 1),
        'base-only': singleValueFlag('base-only', 'base', 1),
        tombstone: { key: 'tombstone', version: 5, deleted: true },
      },
      segments: {
        segment: { key: 'segment', version: 1 },
      },
    });
    layer = new OverrideLayer();
    overlay = new ReadStoreOverlay(base, layer);
  });

  it('returns the override entry for a key the layer holds and the base entry otherwise', async () => {
    layer.setAll(
      [singleValueFlag('both', 'override', 99), singleValueFlag('override-only', 'override', 1)],
      [],
    );

    const both = await promiseGet(overlay, 'features', 'both');
    expect(both.version).toEqual(99);
    expect(both._sdk_override).toBe(true);

    const baseOnly = await promiseGet(overlay, 'features', 'base-only');
    expect(baseOnly.version).toEqual(1);
    expect(baseOnly).not.toHaveProperty('_sdk_override');

    const overrideOnly = await promiseGet(overlay, 'features', 'override-only');
    expect(overrideOnly._sdk_override).toBe(true);

    expect(await promiseGet(overlay, 'features', 'nowhere')).toBeNull();
  });

  it('applies precedence to segments', async () => {
    layer.setAll([], [{ key: 'segment', version: 7 }]);
    const segment = await promiseGet(overlay, 'segments', 'segment');
    expect(segment.version).toEqual(7);
    expect(segment._sdk_override).toBe(true);
  });

  it('returns the union of base and layer entries with the override entry winning', async () => {
    layer.setAll(
      [
        singleValueFlag('both', 'override', 99),
        singleValueFlag('tombstone', 'override', 1),
        singleValueFlag('override-only', 'override', 1),
      ],
      [],
    );

    const all = await promiseAll(overlay);
    expect(Object.keys(all).sort()).toEqual(['base-only', 'both', 'override-only', 'tombstone']);
    expect(all.both.version).toEqual(99);
    expect(all.both._sdk_override).toBe(true);
    expect(all['base-only']).not.toHaveProperty('_sdk_override');
    expect(all.tombstone._sdk_override).toBe(true);
    expect(all['override-only']._sdk_override).toBe(true);
  });

  it('passes reads through unchanged when the layer is empty', async () => {
    const all = await promiseAll(overlay);
    expect(Object.keys(all).sort()).toEqual(['base-only', 'both']);
    expect(await promiseGet(overlay, 'features', 'tombstone')).toBeNull();
    const both = await promiseGet(overlay, 'features', 'both');
    expect(both).not.toHaveProperty('_sdk_override');
  });

  it('delegates initialized to the base store', async () => {
    expect(await promiseInitialized(overlay)).toBe(true);
    layer.setAll([singleValueFlag('flag', 'override')], []);
    expect(await promiseInitialized(overlay)).toBe(true);
  });
});

describe('given an uninitialized base store', () => {
  it('serves override entries and reports the base as not initialized', async () => {
    const base = new InMemoryFeatureStore();
    const layer = new OverrideLayer();
    const overlay = new ReadStoreOverlay(base, layer);
    layer.setAll([singleValueFlag('flag1', 'override')], []);

    const flag = await promiseGet(overlay, 'features', 'flag1');
    expect(flag._sdk_override).toBe(true);
    expect(await promiseGet(overlay, 'features', 'other')).toBeNull();
    expect(Object.keys(await promiseAll(overlay))).toEqual(['flag1']);
    expect(await promiseInitialized(overlay)).toBe(false);
  });
});
