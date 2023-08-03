import { interfaces } from '@launchdarkly/node-server-sdk';

import RedisClientState from '../src/RedisClientState';
import RedisCore from '../src/RedisCore';
import clearPrefix from './clearPrefix';

const featuresKind = { namespace: 'features', deserialize: (data: string) => JSON.parse(data) };
const segmentsKind = { namespace: 'segments', deserialize: (data: string) => JSON.parse(data) };
const configurationOverridesKind = {
  namespace: 'configurationOverrides',
  deserialize: (data: string) => JSON.parse(data),
};
const metricsKind = { namespace: 'metrics', deserialize: (data: string) => JSON.parse(data) };

const dataKind = {
  features: featuresKind,
  segments: segmentsKind,
  configurationOverrides: configurationOverridesKind,
  metrics: metricsKind,
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
  constructor(private readonly core: RedisCore) {}

  init(allData: interfaces.KindKeyedStore<interfaces.PersistentStoreDataKind>): Promise<void> {
    return promisify((cb) => this.core.init(allData, cb));
  }

  get(
    kind: interfaces.PersistentStoreDataKind,
    key: string,
  ): Promise<interfaces.SerializedItemDescriptor | undefined> {
    return promisify((cb) => this.core.get(kind, key, cb));
  }

  getAll(
    kind: interfaces.PersistentStoreDataKind,
  ): Promise<interfaces.KeyedItem<string, interfaces.SerializedItemDescriptor>[] | undefined> {
    return promisify((cb) => this.core.getAll(kind, cb));
  }

  upsert(
    kind: interfaces.PersistentStoreDataKind,
    key: string,
    descriptor: interfaces.SerializedItemDescriptor,
  ): Promise<UpsertResult> {
    return new Promise<UpsertResult>((resolve) => {
      this.core.upsert(kind, key, descriptor, (err, updatedDescriptor) => {
        resolve({ err, updatedDescriptor });
      });
    });
  }

  initialized(): Promise<boolean> {
    return promisify((cb) => this.core.initialized(cb));
  }

  close(): void {
    this.core.close();
  }

  getDescription(): string {
    return this.core.getDescription();
  }
}

describe('given an empty store', () => {
  let core: RedisCore;
  let facade: AsyncCoreFacade;

  beforeEach(async () => {
    await clearPrefix('launchdarkly');
    core = new RedisCore(new RedisClientState(), undefined);
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
    const configurationOverrides = [
      { key: 'first', item: { version: 1, serializedItem: `{"version":3}`, deleted: false } },
    ];
    const metrics = [
      { key: 'first', item: { version: 1, serializedItem: `{"version":4}`, deleted: false } },
    ];

    await facade.init([
      { key: dataKind.features, item: flags },
      { key: dataKind.segments, item: segments },
      { key: dataKind.configurationOverrides, item: configurationOverrides },
      { key: dataKind.metrics, item: metrics },
    ]);

    const items1 = await facade.getAll(dataKind.features);
    const items2 = await facade.getAll(dataKind.segments);
    const overrides1 = await facade.getAll(dataKind.configurationOverrides);
    const metrics1 = await facade.getAll(dataKind.metrics);

    // Reading from the store will not maintain the version.
    expect(items1).toEqual([
      {
        key: 'first',
        item: { version: 0, deleted: false, serializedItem: '{"version":1}' },
      },
      {
        key: 'second',
        item: { version: 0, deleted: false, serializedItem: '{"version":1}' },
      },
    ]);
    expect(items2).toEqual([
      {
        key: 'first',
        item: { version: 0, deleted: false, serializedItem: '{"version":2}' },
      },
    ]);

    expect(overrides1).toEqual([
      {
        key: 'first',
        item: { version: 0, deleted: false, serializedItem: '{"version":3}' },
      },
    ]);
    expect(metrics1).toEqual([
      {
        key: 'first',
        item: { version: 0, deleted: false, serializedItem: '{"version":4}' },
      },
    ]);

    const newFlags = [
      { key: 'first', item: { version: 2, serializedItem: `{"version":2}`, deleted: false } },
    ];
    const newSegments = [
      { key: 'first', item: { version: 3, serializedItem: `{"version":3}`, deleted: false } },
    ];
    const newOverrides = [
      { key: 'first', item: { version: 2, serializedItem: `{"version":5}`, deleted: false } },
    ];
    const newMetrics = [
      { key: 'first', item: { version: 3, serializedItem: `{"version":6}`, deleted: false } },
    ];

    await facade.init([
      { key: dataKind.features, item: newFlags },
      { key: dataKind.segments, item: newSegments },
      { key: dataKind.configurationOverrides, item: newOverrides },
      { key: dataKind.metrics, item: newMetrics },
    ]);

    const items3 = await facade.getAll(dataKind.features);
    const items4 = await facade.getAll(dataKind.segments);
    const overrides2 = await facade.getAll(dataKind.configurationOverrides);
    const metrics2 = await facade.getAll(dataKind.metrics);

    expect(items3).toEqual([
      {
        key: 'first',
        item: { version: 0, deleted: false, serializedItem: '{"version":2}' },
      },
    ]);
    expect(items4).toEqual([
      {
        key: 'first',
        item: { version: 0, deleted: false, serializedItem: '{"version":3}' },
      },
    ]);
    expect(overrides2).toEqual([
      {
        key: 'first',
        item: { version: 0, deleted: false, serializedItem: '{"version":5}' },
      },
    ]);
    expect(metrics2).toEqual([
      {
        key: 'first',
        item: { version: 0, deleted: false, serializedItem: '{"version":6}' },
      },
    ]);
  });
});

describe('given a store with basic data', () => {
  let core: RedisCore;
  let facade: AsyncCoreFacade;

  const feature1 = { key: 'foo', version: 10 };
  const feature2 = { key: 'bar', version: 10 };

  beforeEach(async () => {
    await clearPrefix('launchdarkly');
    core = new RedisCore(new RedisClientState(), undefined);
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
      version: 0,
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
    expect(result).toEqual([
      {
        key: 'foo',
        item: { version: 0, serializedItem: JSON.stringify(feature1), deleted: false },
      },
      {
        key: 'bar',
        item: { version: 0, serializedItem: JSON.stringify(feature2), deleted: false },
      },
    ]);
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
    // Read version 0 with redis.
    expect(result).toEqual({ ...descriptor, version: 0 });
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
      version: 0,
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
    expect(result).toEqual({ ...descriptor, version: 0 });
  });
});
