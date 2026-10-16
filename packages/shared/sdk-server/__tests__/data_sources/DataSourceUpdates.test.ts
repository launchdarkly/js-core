import { AsyncQueue } from 'launchdarkly-js-test-helpers';

import { internal } from '@launchdarkly/js-sdk-common';

import { LDTransactionalFeatureStore } from '../../src/api/subsystems';
import promisify from '../../src/async/promisify';
import DataSourceUpdates from '../../src/data_sources/TransactionalDataSourceUpdates';
import { OverrideLayer } from '../../src/overrides';
import InMemoryFeatureStore from '../../src/store/InMemoryFeatureStore';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';

type InitMetadata = internal.InitMetadata;

it('passes initialization metadata to underlying feature store', () => {
  const metadata: InitMetadata = { environmentId: '12345' };
  const store = new InMemoryFeatureStore();
  store.applyChanges = jest.fn();
  const updates = new DataSourceUpdates(
    store,
    () => false,
    () => {},
  );
  updates.init({}, () => {}, metadata);
  expect(store.applyChanges).toHaveBeenCalledTimes(1);
  expect(store.applyChanges).toHaveBeenNthCalledWith(
    1,
    true,
    expect.any(Object),
    expect.any(Function),
    metadata,
    undefined,
  );
});

describe.each([true, false])(
  'given a DataSourceUpdates with in memory store and change listeners: %s',
  (listen) => {
    let store: LDTransactionalFeatureStore;
    let updates: DataSourceUpdates;

    const queue = new AsyncQueue<string>();

    beforeEach(() => {
      store = new InMemoryFeatureStore();

      updates = new DataSourceUpdates(
        store,
        () => listen,
        (key) => queue.add(key),
      );
    });

    it('sends events for an init of an empty store', async () => {
      await promisify((cb) => {
        updates.init(
          {
            features: {
              a: { key: 'a', version: 1 },
              b: { key: 'b', version: 1 },
            },
            segments: {},
          },
          () => {
            cb(undefined);
          },
        );
      });

      if (listen) {
        expect(await queue.take()).toEqual('a');
        expect(await queue.take()).toEqual('b');
      }
      expect(queue.isEmpty()).toBeTruthy();
    });

    it('sends events for re-init of non-empty store', async () => {
      const allData0 = {
        features: {
          a: { key: 'a', version: 1 },
          b: { key: 'b', version: 1 },
          c: { key: 'c', version: 1 },
        },
        segments: {},
      };
      const allData1 = {
        features: {
          a: { key: 'a', version: 1 },
          b: { key: 'b', version: 2 },
        },
        segments: {},
      };

      await promisify((cb) => {
        updates.init(allData0, () => {
          cb(undefined);
        });
      });

      if (listen) {
        expect(await queue.take()).toEqual('a');
        expect(await queue.take()).toEqual('b');
        expect(await queue.take()).toEqual('c');
      }
      expect(queue.isEmpty()).toBeTruthy();

      await promisify((cb) => {
        updates.init(allData1, () => {
          cb(undefined);
        });
      });

      if (listen) {
        // A remained the same.
        expect(await queue.take()).toEqual('b'); // Different version
        expect(await queue.take()).toEqual('c'); // Deleted
      }
      expect(queue.isEmpty()).toBeTruthy();
    });

    it('sends events for upserts', async () => {
      await promisify((cb) => {
        updates.init(
          {
            features: {
              a: { key: 'a', version: 1 },
            },
            segments: {},
          },
          () => {
            cb(undefined);
          },
        );
      });

      if (listen) {
        expect(await queue.take()).toEqual('a');
      }
      expect(queue.isEmpty()).toBeTruthy();

      // Upsert the same thing twice. Should only be 1 event.
      promisify((cb) => {
        updates.upsert(VersionedDataKinds.Features, { key: 'a', version: 2 }, () => cb(undefined));
      });
      promisify((cb) => {
        updates.upsert(VersionedDataKinds.Features, { key: 'a', version: 2 }, () => cb(undefined));
      });

      if (listen) {
        expect(await queue.take()).toEqual('a');
      }
      expect(queue.isEmpty()).toBeTruthy();
    });

    it('sends events for transitive dependencies', async () => {
      await promisify((cb) => {
        updates.init(
          {
            features: {
              a: { key: 'a', version: 1 },
              b: { key: 'b', version: 1, prerequisites: [{ key: 'c' }, { key: 'e' }] },
              c: {
                key: 'c',
                version: 1,
                prerequisites: [{ key: 'd' }],
                rules: [{ clauses: [{ op: 'segmentMatch', values: ['s0'] }] }],
              },
              d: { key: 'd', version: 1, prerequisites: [{ key: 'e' }] },
              e: { key: 'e', version: 1 },
            },
            segments: {
              s0: { key: 's0', version: 1 },
            },
          },
          () => {
            cb(undefined);
          },
        );
      });

      if (listen) {
        expect(await queue.take()).toEqual('a');
        expect(await queue.take()).toEqual('b');
        expect(await queue.take()).toEqual('c');
        expect(await queue.take()).toEqual('d');
        expect(await queue.take()).toEqual('e');
      }
      expect(queue.isEmpty()).toBeTruthy();

      promisify((cb) => {
        updates.upsert(
          VersionedDataKinds.Features,
          { key: 'd', version: 2, prerequisites: [{ key: 'e' }] },
          () => cb(undefined),
        );
      });

      if (listen) {
        expect([await queue.take(), await queue.take(), await queue.take()].sort()).toEqual([
          'b',
          'c',
          'd',
        ]);
      }
      expect(queue.isEmpty()).toBeTruthy();

      promisify((cb) => {
        updates.upsert(VersionedDataKinds.Segments, { key: 's0', version: 2 }, () => cb(undefined));
      });

      if (listen) {
        expect([await queue.take(), await queue.take()].sort()).toEqual(['b', 'c']);
      }
      expect(queue.isEmpty()).toBeTruthy();
    });
  },
);

describe('given a DataSourceUpdates whose external dependencies come from an override layer', () => {
  let store: LDTransactionalFeatureStore;
  let layer: OverrideLayer;
  let updates: DataSourceUpdates;
  let queue: AsyncQueue<string>;

  function overriddenFlagMatching(key: string, segmentKey: string): any {
    return {
      key,
      version: 1,
      on: true,
      fallthrough: { variation: 0 },
      variations: [true, false],
      rules: [
        {
          id: 'rule',
          variation: 0,
          clauses: [{ attribute: '', op: 'segmentMatch', values: [segmentKey], negate: false }],
        },
      ],
    };
  }

  async function takeSorted(count: number): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < count; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      keys.push(await queue.take());
    }
    return keys.sort();
  }

  beforeEach(() => {
    queue = new AsyncQueue<string>();
    store = new InMemoryFeatureStore();
    layer = new OverrideLayer();
    updates = new DataSourceUpdates(
      store,
      () => true,
      (key) => queue.add(key),
      layer,
    );
  });

  it('notifies an overridden flag when the LaunchDarkly segment it references changes', async () => {
    layer.setAll([overriddenFlagMatching('overridden', 'segment1')], []);
    await promisify((cb) => {
      updates.init(
        {
          features: { ld: { key: 'ld', version: 1 } },
          segments: { segment1: { key: 'segment1', version: 1 } },
        },
        () => cb(undefined),
      );
    });
    // The initial data set counts every item as modified; the segment reaches the override.
    expect(await takeSorted(2)).toEqual(['ld', 'overridden']);

    await promisify((cb) => {
      updates.upsert(VersionedDataKinds.Segments, { key: 'segment1', version: 2 }, () =>
        cb(undefined),
      );
    });
    expect(await queue.take()).toEqual('overridden');
    expect(queue.isEmpty()).toBeTruthy();
  });

  it('follows a chain that crosses from LaunchDarkly data into the override layer and back', async () => {
    // parent is a LaunchDarkly flag whose prerequisite is overridden; overridden references the
    // LaunchDarkly segment. A change to the segment reaches parent through the override entry.
    layer.setAll([overriddenFlagMatching('overridden', 'segment1')], []);
    await promisify((cb) => {
      updates.init(
        {
          features: {
            parent: {
              key: 'parent',
              version: 1,
              prerequisites: [{ key: 'overridden', variation: 0 }],
            },
          },
          segments: { segment1: { key: 'segment1', version: 1 } },
        },
        () => cb(undefined),
      );
    });
    expect(await takeSorted(2)).toEqual(['overridden', 'parent']);

    await promisify((cb) => {
      updates.upsert(VersionedDataKinds.Segments, { key: 'segment1', version: 2 }, () =>
        cb(undefined),
      );
    });
    expect(await takeSorted(2)).toEqual(['overridden', 'parent']);
    expect(queue.isEmpty()).toBeTruthy();
  });

  it('does not notify an overridden flag for an item it does not reference', async () => {
    layer.setAll([overriddenFlagMatching('overridden', 'segment1')], []);
    await promisify((cb) => {
      updates.init({ features: {}, segments: { segment2: { key: 'segment2', version: 1 } } }, () =>
        cb(undefined),
      );
    });
    await promisify((cb) => {
      updates.upsert(VersionedDataKinds.Segments, { key: 'segment2', version: 2 }, () =>
        cb(undefined),
      );
    });
    await promisify((cb) => {
      updates.upsert(VersionedDataKinds.Features, { key: 'ld', version: 1 }, () => cb(undefined));
    });
    expect(await queue.take()).toEqual('ld');
    expect(queue.isEmpty()).toBeTruthy();
  });
});
