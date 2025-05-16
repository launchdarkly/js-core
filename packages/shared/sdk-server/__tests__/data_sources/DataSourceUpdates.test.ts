import { AsyncQueue } from 'launchdarkly-js-test-helpers';

import { internal } from '@launchdarkly/js-sdk-common';

import { LDTransactionalFeatureStore } from '../../src/api/subsystems';
import promisify from '../../src/async/promisify';
import DataSourceUpdates from '../../src/data_sources/TransactionalDataSourceUpdates';
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
