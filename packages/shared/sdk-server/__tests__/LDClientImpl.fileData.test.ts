import { AsyncQueue } from 'launchdarkly-js-test-helpers';

import { LDOptions } from '../src/api/options/LDOptions';
import LDClientImpl from '../src/LDClientImpl';
import InMemoryFeatureStore from '../src/store/InMemoryFeatureStore';
import { createBasicPlatform } from './createBasicPlatform';
import MockFilesystem from './data_sources/filedata/MockFilesystem';
import makeCallbacks from './makeCallbacks';

const context = { kind: 'user', key: 'user-key' };
const directory = '/data';
const path = `${directory}/flags.json`;
const document = (value: string) => JSON.stringify({ flagValues: { 'flag-key': value } });

it('initializes from a file synchronizer, serves the new value when the file changes, and keeps no selector', async () => {
  const filesystem = new MockFilesystem();
  filesystem.set(path, document('a'));
  const platform = { ...createBasicPlatform(), fileSystem: filesystem };
  const updates = new AsyncQueue<string>();
  const options: LDOptions = {
    sendEvents: false,
    dataSystem: {
      dataSource: {
        dataSourceOptionsType: 'custom',
        initializers: [],
        synchronizers: [{ type: 'file', paths: [path], autoUpdate: true }],
      },
    },
  };
  const client = new LDClientImpl('sdk-key', platform, options, {
    ...makeCallbacks(true),
    onUpdate: (key: string) => updates.add(key),
  });
  try {
    // Wait for the client to initialize from the file.
    await client.waitForInitialization({ timeout: 10 });

    // The client serves the value from the file and reports the flag of the first load.
    expect(client.initialized()).toBe(true);
    expect(await client.variation('flag-key', context, 'default')).toEqual('a');
    expect(await updates.take()).toEqual('flag-key');

    // Change the file and report the change.
    filesystem.set(path, document('b'));
    filesystem.emit(directory, 'change');

    // The client emits an update event for the flag and serves the new value. The store keeps no
    // selector from the file data.
    expect(await updates.take()).toEqual('flag-key');
    expect(await client.variation('flag-key', context, 'default')).toEqual('b');
    expect(platform.requests.fetch).not.toHaveBeenCalled();
    expect(platform.requests.createEventSource).not.toHaveBeenCalled();
    // @ts-ignore The test reads the private store of the client.
    // eslint-disable-next-line no-underscore-dangle
    expect(client._featureStore.getSelector()).toBe('');
  } finally {
    client.close();
  }
});

it('emits an update event when a new file synchronizer loads a changed flag value', async () => {
  jest.useFakeTimers();
  const missingPath = `${directory}/missing.json`;
  const filesystem = new MockFilesystem();
  filesystem.set(path, document('a'));
  const platform = { ...createBasicPlatform(), fileSystem: filesystem };
  const onUpdate = jest.fn();
  const options: LDOptions = {
    sendEvents: false,
    dataSystem: {
      dataSource: {
        dataSourceOptionsType: 'custom',
        initializers: [],
        synchronizers: [
          { type: 'file', paths: [missingPath] },
          { type: 'file', paths: [path] },
        ],
      },
    },
  };
  const client = new LDClientImpl('sdk-key', platform, options, {
    ...makeCallbacks(true),
    onUpdate,
  });
  try {
    // The first synchronizer fails and the second one loads the file.
    await jest.advanceTimersByTimeAsync(5000);
    expect(await client.variation('flag-key', context, 'default')).toEqual('a');
    onUpdate.mockClear();

    // Change the file. Then the data system recovers to the first synchronizer, which fails
    // again, and creates a new second synchronizer.
    filesystem.set(path, document('b'));
    await jest.advanceTimersByTimeAsync(6 * 60 * 1000);

    // The client emits an update event for the flag and serves the new value.
    expect(onUpdate).toHaveBeenCalledWith('flag-key');
    expect(await client.variation('flag-key', context, 'default')).toEqual('b');
  } finally {
    client.close();
    jest.useRealTimers();
  }
});

it.each([
  { role: 'initializer', description: 'no paths', entry: { type: 'file' } },
  { role: 'initializer', description: 'empty paths', entry: { type: 'file', paths: [] } },
  {
    role: 'initializer',
    description: 'paths that are not an array',
    entry: { type: 'file', paths: path },
  },
  { role: 'synchronizer', description: 'no paths', entry: { type: 'file' } },
  { role: 'synchronizer', description: 'empty paths', entry: { type: 'file', paths: [] } },
  {
    role: 'synchronizer',
    description: 'paths that are not an array',
    entry: { type: 'file', paths: path },
  },
])(
  'throws before it creates the persistent store when a file $role has $description',
  ({ role, entry }) => {
    const persistentStore = jest.fn(() => new InMemoryFeatureStore());
    const options: LDOptions = {
      sendEvents: false,
      dataSystem: {
        persistentStore,
        dataSource: {
          dataSourceOptionsType: 'custom',
          initializers: role === 'initializer' ? [entry as any] : [],
          synchronizers: role === 'synchronizer' ? [entry as any] : [],
        },
      },
    };

    // Construct a client with the file entry.
    const construct = () =>
      new LDClientImpl('sdk-key', createBasicPlatform(), options, makeCallbacks(false));

    // The constructor throws and does not create the persistent store.
    expect(construct).toThrow(`The file ${role} requires at least one file path`);
    expect(persistentStore).not.toHaveBeenCalled();
  },
);

it.each(['initializer', 'synchronizer'])(
  'throws before it creates the persistent store when a file %s has a platform without a file system',
  (role) => {
    const persistentStore = jest.fn(() => new InMemoryFeatureStore());
    const entry = { type: 'file' as const, paths: [path] };
    const options: LDOptions = {
      sendEvents: false,
      dataSystem: {
        persistentStore,
        dataSource: {
          dataSourceOptionsType: 'custom',
          initializers: role === 'initializer' ? [entry] : [],
          synchronizers: role === 'synchronizer' ? [entry] : [],
        },
      },
    };
    const platform = { ...createBasicPlatform(), fileSystem: undefined };

    // Construct a client with the file entry.
    const construct = () => new LDClientImpl('sdk-key', platform, options, makeCallbacks(false));

    // The constructor throws and does not create the persistent store.
    expect(construct).toThrow(`The file ${role} requires a platform with a file system`);
    expect(persistentStore).not.toHaveBeenCalled();
  },
);

describe('given a client with an auto-updating file synchronizer', () => {
  let filesystem: MockFilesystem;
  let updates: AsyncQueue<string>;
  let client: LDClientImpl;

  const segmentFlag = {
    key: 'segment-flag',
    version: 1,
    on: true,
    rules: [
      {
        id: 'rule-id',
        clauses: [{ attribute: 'key', op: 'segmentMatch', values: ['segment-key'] }],
        variation: 1,
      },
    ],
    fallthrough: { variation: 0 },
    variations: [false, true],
  };
  const fileDocument = (flagValue: string, segmentIncluded: string[]) =>
    JSON.stringify({
      flags: {
        'versionless-flag': {
          key: 'versionless-flag',
          on: true,
          fallthrough: { variation: 0 },
          variations: [flagValue],
        },
        'segment-flag': segmentFlag,
      },
      segments: { 'segment-key': { key: 'segment-key', included: segmentIncluded } },
    });

  beforeEach(async () => {
    filesystem = new MockFilesystem();
    filesystem.set(path, fileDocument('a', []));
    const platform = { ...createBasicPlatform(), fileSystem: filesystem };
    updates = new AsyncQueue<string>();
    const options: LDOptions = {
      sendEvents: false,
      dataSystem: {
        dataSource: {
          dataSourceOptionsType: 'custom',
          initializers: [],
          synchronizers: [{ type: 'file', paths: [path], autoUpdate: true }],
        },
      },
    };
    client = new LDClientImpl('sdk-key', platform, options, {
      ...makeCallbacks(true),
      onUpdate: (key: string) => updates.add(key),
    });
    await client.waitForInitialization({ timeout: 10 });
    // Take the update events of the first load, one for each flag.
    await updates.take();
    await updates.take();
  });

  afterEach(() => {
    client.close();
  });

  it('emits an update event when a flag without a version changes', async () => {
    // Change the value of the flag without a version.
    filesystem.set(path, fileDocument('b', []));
    filesystem.emit(directory, 'change');

    // The client emits an update event for the flag and serves the new value.
    expect(await updates.take()).toEqual('versionless-flag');
    expect(await client.variation('versionless-flag', context, 'default')).toEqual('b');
  });

  it('emits an update event for a dependent flag when a segment without a version changes', async () => {
    // Include the context in the segment without a version.
    filesystem.set(path, fileDocument('a', [context.key]));
    filesystem.emit(directory, 'change');

    // The client emits an update event for the flag that uses the segment and serves the rule
    // variation.
    const keys = [await updates.take(), await updates.take()].sort();
    expect(keys).toEqual(['segment-flag', 'versionless-flag']);
    expect(await client.variation('segment-flag', context, 'default')).toEqual(true);
  });
});

it('emits no update event on reload for a flag with an unchanged version', async () => {
  const filesystem = new MockFilesystem();
  const versionedDocument = (value: string) =>
    JSON.stringify({
      flags: {
        'versioned-flag': {
          key: 'versioned-flag',
          version: 3,
          on: true,
          fallthrough: { variation: 0 },
          variations: ['fixed'],
        },
      },
      flagValues: { 'flag-key': value },
    });
  filesystem.set(path, versionedDocument('a'));
  const platform = { ...createBasicPlatform(), fileSystem: filesystem };
  const updates = new AsyncQueue<string>();
  const options: LDOptions = {
    sendEvents: false,
    dataSystem: {
      dataSource: {
        dataSourceOptionsType: 'custom',
        initializers: [],
        synchronizers: [{ type: 'file', paths: [path], autoUpdate: true }],
      },
    },
  };
  const client = new LDClientImpl('sdk-key', platform, options, {
    ...makeCallbacks(true),
    onUpdate: (key: string) => updates.add(key),
  });
  try {
    await client.waitForInitialization({ timeout: 10 });
    expect([await updates.take(), await updates.take()].sort()).toEqual([
      'flag-key',
      'versioned-flag',
    ]);

    // Change only the flag value entry, so that the file loads again.
    filesystem.set(path, versionedDocument('b'));
    filesystem.emit(directory, 'change');

    // The reload emits an update event for the changed flag and none for the flag whose version
    // did not change. The events of one load are all queued before the first one is taken.
    expect(await updates.take()).toEqual('flag-key');
    expect(updates.isEmpty()).toBe(true);
  } finally {
    client.close();
  }
});
