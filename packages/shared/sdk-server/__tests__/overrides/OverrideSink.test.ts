import { LDFeatureStoreDataStorage } from '../../src/api/subsystems';
import { OverrideLayer, OverrideSink } from '../../src/overrides';
import AsyncStoreFacade from '../../src/store/AsyncStoreFacade';
import InMemoryFeatureStore from '../../src/store/InMemoryFeatureStore';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';
import TestLogger from '../Logger';
import { singleValueFlag } from './overridesTestSupport';

function flagWithSegmentRule(key: string, segmentKey: string, version: number = 1): any {
  return {
    key,
    version,
    on: true,
    fallthrough: { variation: 0 },
    variations: [true, false],
    rules: [
      {
        id: 'r',
        variation: 0,
        clauses: [{ attribute: '', op: 'segmentMatch', values: [segmentKey] }],
      },
    ],
  };
}

function flagWithPrerequisite(key: string, prereqKey: string, version: number = 1): any {
  return {
    ...singleValueFlag(key, true, version),
    on: true,
    prerequisites: [{ key: prereqKey, variation: 0 }],
  };
}

// Notifications follow the layer replacement asynchronously. Let them run.
const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

describe('given a sink over an initialized base store', () => {
  let base: InMemoryFeatureStore;
  let layer: OverrideLayer;
  let notified: string[];
  let listening: boolean;
  let sink: OverrideSink;
  let logger: TestLogger;

  const takeNotified = () => {
    const result = notified.sort();
    notified = [];
    return result;
  };

  const setupBase = async (data: LDFeatureStoreDataStorage) => {
    await new AsyncStoreFacade(base).init(data);
  };

  beforeEach(() => {
    base = new InMemoryFeatureStore();
    layer = new OverrideLayer();
    notified = [];
    listening = true;
    logger = new TestLogger();
    sink = new OverrideSink(
      layer,
      base,
      (key) => notified.push(key),
      () => listening,
      logger,
    );
  });

  it('notifies on add, change, and remove', async () => {
    await setupBase({ features: { flag1: singleValueFlag('flag1', 'base', 1) } });

    // Adding an override is a change even though flag1 also exists in base data.
    sink.setOverrides([singleValueFlag('flag1', 'a', 1), singleValueFlag('flag2', 'a', 1)], []);
    await settle();
    expect(takeNotified()).toEqual(['flag1', 'flag2']);

    // An identical replacement, rebuilt from scratch, changes nothing.
    sink.setOverrides([singleValueFlag('flag1', 'a', 1), singleValueFlag('flag2', 'a', 1)], []);
    await settle();
    expect(takeNotified()).toEqual([]);

    // Changing one entry notifies only that entry.
    sink.setOverrides([singleValueFlag('flag1', 'a', 1), singleValueFlag('flag2', 'b', 1)], []);
    await settle();
    expect(takeNotified()).toEqual(['flag2']);

    // Removing overrides notifies them: flag1 reverts to base data, flag2 to not found.
    sink.setOverrides([], []);
    await settle();
    expect(takeNotified()).toEqual(['flag1', 'flag2']);
  });

  it('makes the new layer contents visible before the notifications run', () => {
    sink.setOverrides([singleValueFlag('flag1', 'a')], []);
    expect(layer.get(VersionedDataKinds.Features, 'flag1')).toBeDefined();
    expect(notified).toEqual([]);
  });

  it('fans a prerequisite override out to the flags that depend on it', async () => {
    await setupBase({
      features: {
        parent: flagWithPrerequisite('parent', 'prereq'),
        grandparent: flagWithPrerequisite('grandparent', 'parent'),
        unrelated: singleValueFlag('unrelated', true),
        prereq: singleValueFlag('prereq', true, 1),
      },
    });

    sink.setOverrides([singleValueFlag('prereq', true, 99)], []);
    await settle();
    expect(takeNotified()).toEqual(['grandparent', 'parent', 'prereq']);
  });

  it('fans a segment override out to the flags that depend on it', async () => {
    await setupBase({
      features: {
        dependent: flagWithSegmentRule('dependent', 'segment1'),
        unrelated: singleValueFlag('unrelated', true),
      },
      segments: { segment1: { key: 'segment1', version: 1 } },
    });

    sink.setOverrides([], [{ key: 'segment1', version: 99 }]);
    await settle();
    // The segment itself is not a flag, so only the dependent flag is notified.
    expect(takeNotified()).toEqual(['dependent']);
  });

  it('notifies a removed override together with the entries that changed', async () => {
    // The override for parent declares a prerequisite on prereq. The base definition of parent
    // has no prerequisites. When the override is removed while prereq changes in the same
    // replacement, parent is notified because its own entry changed.
    await setupBase({
      features: {
        parent: singleValueFlag('parent', true, 1),
        prereq: singleValueFlag('prereq', true, 1),
      },
    });

    sink.setOverrides([flagWithPrerequisite('parent', 'prereq')], []);
    await settle();
    expect(takeNotified()).toEqual(['parent']);

    // Replace the layer with an override of the prerequisite only. The parent override is removed
    // (a change) and prereq is added (a change).
    sink.setOverrides([singleValueFlag('prereq', true, 99)], []);
    await settle();
    expect(takeNotified()).toEqual(['parent', 'prereq']);

    // Now only prereq is overridden and nothing depends on it in the new view either.
    sink.setOverrides([singleValueFlag('prereq', true, 100)], []);
    await settle();
    expect(takeNotified()).toEqual(['prereq']);
  });

  it('skips the change computation when nothing is listening', async () => {
    listening = false;
    const all = jest.spyOn(base, 'all');

    sink.setOverrides([singleValueFlag('flag1', 'a')], []);
    await settle();

    expect(layer.get(VersionedDataKinds.Features, 'flag1')).toBeDefined();
    expect(all).not.toHaveBeenCalled();
    expect(notified).toEqual([]);
  });

  it('computes notifications for successive snapshots in order', async () => {
    await setupBase({ features: {} });

    sink.setOverrides([singleValueFlag('flag1', 'a')], []);
    sink.setOverrides([singleValueFlag('flag2', 'a')], []);
    sink.setOverrides([], []);
    await settle();

    // flag1 added, then flag1 removed and flag2 added, then flag2 removed.
    expect(notified).toEqual(['flag1', 'flag1', 'flag2', 'flag2']);
  });

  it('logs and continues when the change computation fails', async () => {
    base.all = () => {
      throw new Error('store failure');
    };

    sink.setOverrides([singleValueFlag('flag1', 'a')], []);
    await settle();
    expect(logger.getCount('error' as any)).toEqual(1);

    // The next snapshot is still applied and its notifications still run.
    base = new InMemoryFeatureStore();
    sink.setOverrides([singleValueFlag('flag2', 'a')], []);
    await settle();
    expect(layer.get(VersionedDataKinds.Features, 'flag2')).toBeDefined();
  });
});
