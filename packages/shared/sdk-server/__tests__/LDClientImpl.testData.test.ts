import { AsyncQueue } from 'launchdarkly-js-test-helpers';

import { LDOptions } from '../src/api/options/LDOptions';
import { LDFeatureStore, LDFeatureStoreDataStorage } from '../src/api/subsystems';
import TestData from '../src/integrations/test_data/TestData';
import LDClientImpl from '../src/LDClientImpl';
import InMemoryFeatureStore from '../src/store/InMemoryFeatureStore';
import { createBasicPlatform } from './createBasicPlatform';
import makeCallbacks from './makeCallbacks';
import waitFor from './waitFor';

// A typed view of the client's private feature store. The bracket access keeps the type
// check and the lint check active without suppression comments.
interface ClientWithStore {
  _featureStore: { getSelector?: () => string | undefined };
}

const context = { kind: 'user', key: 'user-key' };

describe('given a platform with mock network requests', () => {
  let platform: ReturnType<typeof createBasicPlatform>;
  let client: LDClientImpl | undefined;

  beforeEach(() => {
    platform = createBasicPlatform();
  });

  afterEach(() => {
    client?.close();
    client = undefined;
  });

  it('initializes from a TestData synchronizer without network requests', async () => {
    const td = new TestData();
    td.update(td.flag('flag-key').variationForAll(true));
    const options: LDOptions = {
      sendEvents: false,
      dataSystem: {
        dataSource: {
          dataSourceOptionsType: 'custom',
          initializers: [],
          synchronizers: [{ type: 'testData', testData: td }],
        },
      },
    };
    client = new LDClientImpl('sdk-key', platform, options, makeCallbacks(false));

    // Wait for the client to initialize.
    await client.waitForInitialization({ timeout: 10 });

    // The client serves the test data and makes no network requests.
    expect(client.initialized()).toBe(true);
    expect(await client.variation('flag-key', context, false)).toBe(true);
    expect(platform.requests.fetch).not.toHaveBeenCalled();
    expect(platform.requests.createEventSource).not.toHaveBeenCalled();
  });

  it('initializes from a TestData initializer without network requests, reports that it has no more data sources, and ignores later changes', async () => {
    const td = new TestData();
    td.update(td.flag('flag-key').variationForAll(true));
    const failures = new AsyncQueue<Error>();
    const options: LDOptions = {
      sendEvents: false,
      dataSystem: {
        dataSource: {
          dataSourceOptionsType: 'custom',
          initializers: [{ type: 'testData', testData: td }],
          synchronizers: [],
        },
      },
    };
    client = new LDClientImpl('sdk-key', platform, options, {
      ...makeCallbacks(false),
      onFailed: (err: Error) => failures.add(err),
    });

    // Wait for the client to initialize and for the data system to fail. Then change the flag.
    await client.waitForInitialization({ timeout: 10 });
    const failure = await failures.take();
    td.update(td.flag('flag-key').variationForAll(false));

    // The client serves the value from the start and not the later change. It makes no network
    // requests, and it reports that it has no more data sources.
    expect(client.initialized()).toBe(true);
    expect(await client.variation('flag-key', context, false)).toBe(true);
    expect(platform.requests.fetch).not.toHaveBeenCalled();
    expect(platform.requests.createEventSource).not.toHaveBeenCalled();
    expect(failure).toMatchObject({ name: 'ExhaustedDataSources' });
  });

  it('sends the test data selector as the basis parameter to a streaming synchronizer that starts after a TestData initializer', async () => {
    const td = new TestData();
    td.update(td.flag('flag-key').variationForAll(true));
    platform.requests.createEventSource = jest.fn(() => ({
      onopen: jest.fn(),
      onclose: jest.fn(),
      onerror: jest.fn(),
      onretrying: jest.fn(),
      addEventListener: jest.fn(),
      close: jest.fn(),
    }));
    const options: LDOptions = {
      sendEvents: false,
      dataSystem: {
        dataSource: {
          dataSourceOptionsType: 'custom',
          initializers: [{ type: 'testData', testData: td }],
          synchronizers: [{ type: 'streaming' }],
        },
        fdv1Fallback: null,
      },
    };
    client = new LDClientImpl('sdk-key', platform, options, makeCallbacks(false));

    // Wait for the client to initialize and for the streaming synchronizer to connect.
    await client.waitForInitialization({ timeout: 10 });
    await waitFor(() => platform.requests.createEventSource.mock.calls.length > 0);

    // The client serves the test data, and the stream request carries the test data
    // selector as its basis parameter.
    expect(await client.variation('flag-key', context, false)).toBe(true);
    const [[uri]] = platform.requests.createEventSource.mock.calls;
    expect(uri).toContain('basis=1');
  });

  it.each([
    { role: 'initializer', description: 'no testData field', entry: { type: 'testData' } },
    { role: 'synchronizer', description: 'no testData field', entry: { type: 'testData' } },
    {
      role: 'initializer',
      description: 'an object without createFDv2Source',
      entry: { type: 'testData', testData: {} },
    },
    {
      role: 'synchronizer',
      description: 'an object without createFDv2Source',
      entry: { type: 'testData', testData: {} },
    },
  ])('throws when a testData $role has $description', ({ role, entry }) => {
    const options: LDOptions = {
      sendEvents: false,
      dataSystem: {
        dataSource: {
          dataSourceOptionsType: 'custom',
          initializers: role === 'initializer' ? [entry as any] : [],
          synchronizers: role === 'synchronizer' ? [entry as any] : [],
        },
      },
    };

    // Construct a client with the invalid entry.
    const construct = () => {
      client = new LDClientImpl('sdk-key', platform, options, makeCallbacks(false));
    };

    // The constructor throws before the data system starts.
    expect(construct).toThrow(`The testData ${role} requires a TestData instance`);
  });

  it.each([
    {
      description: 'a testData initializer without a TestData instance',
      initializers: [{ type: 'testData' }],
      synchronizers: [],
      message: 'The testData initializer requires a TestData instance',
    },
    {
      description: 'a testData synchronizer without a TestData instance',
      initializers: [],
      synchronizers: [{ type: 'testData' }],
      message: 'The testData synchronizer requires a TestData instance',
    },
    {
      description: 'an initializer with an unsupported type',
      initializers: [{ type: 'streaming' }],
      synchronizers: [],
      message: 'Unsupported initializer type',
    },
    {
      description: 'a synchronizer with an unsupported type',
      initializers: [],
      synchronizers: [{ type: 'file', paths: [] }],
      message: 'Unsupported synchronizer type',
    },
    {
      description: 'a file initializer without a paths field',
      initializers: [{ type: 'file' }],
      synchronizers: [],
      message: 'The file initializer requires a paths array with at least one path',
    },
    {
      description: 'a file initializer with an empty paths array',
      initializers: [{ type: 'file', paths: [] }],
      synchronizers: [],
      message: 'The file initializer requires a paths array with at least one path',
    },
  ])(
    'throws before it creates the persistent store, with $description',
    ({ initializers, synchronizers, message }) => {
      const persistentStore = jest.fn(() => new InMemoryFeatureStore());
      const options: LDOptions = {
        sendEvents: false,
        dataSystem: {
          persistentStore,
          dataSource: {
            dataSourceOptionsType: 'custom',
            initializers: initializers as any,
            synchronizers: synchronizers as any,
          },
        },
      };

      // Construct a client with the invalid entry.
      const construct = () => {
        client = new LDClientImpl('sdk-key', platform, options, makeCallbacks(false));
      };

      // The constructor throws and does not create the persistent store.
      expect(construct).toThrow(message);
      expect(persistentStore).not.toHaveBeenCalled();
    },
  );

  it.each([
    { description: 'a TestData synchronizer', useInitializer: false, expectedSelector: '1' },
    {
      description: 'a TestData initializer and synchronizer',
      useInitializer: true,
      expectedSelector: '2',
    },
  ])(
    'initializes, emits an update event, and serves the new value when the TestData changes, with $description',
    async ({ useInitializer, expectedSelector }) => {
      const td = new TestData();
      const updates = new AsyncQueue<string>();
      const entry = { type: 'testData' as const, testData: td };
      const options: LDOptions = {
        sendEvents: false,
        dataSystem: {
          dataSource: {
            dataSourceOptionsType: 'custom',
            initializers: useInitializer ? [entry] : [],
            synchronizers: [entry],
          },
        },
      };
      client = new LDClientImpl('sdk-key', platform, options, {
        ...makeCallbacks(true),
        onUpdate: (key: string) => updates.add(key),
      });
      await client.waitForInitialization({ timeout: 10 });

      // Add a flag to the test data.
      td.update(td.flag('flag-key').variationForAll(false));

      // The client emits an update event for the flag and serves its value. The store keeps
      // the selector of the last payload from the test data.
      expect(await updates.take()).toBe('flag-key');
      expect(await client.variation('flag-key', context, true)).toBe(false);
      const store = (client as unknown as ClientWithStore)['_featureStore'];
      expect(store.getSelector?.()).toBe(expectedSelector);
    },
  );

  it('clears the flag and segment namespaces of the persistent store when the test data is empty', async () => {
    // A persistent store that records the data of each init call.
    const initCalls: LDFeatureStoreDataStorage[] = [];
    const persistentStore: LDFeatureStore = {
      init: (allData, callback) => {
        initCalls.push(allData);
        callback();
      },
      get: (_kind, _key, callback) => callback(null),
      all: (_kind, callback) => callback({}),
      upsert: (_kind, _data, callback) => callback(),
      delete: (_kind, _key, _version, callback) => callback(),
      initialized: (callback) => callback(false),
      close: () => {},
    };
    const options: LDOptions = {
      sendEvents: false,
      dataSystem: {
        persistentStore: () => persistentStore,
        dataSource: {
          dataSourceOptionsType: 'custom',
          initializers: [],
          synchronizers: [{ type: 'testData', testData: new TestData() }],
        },
      },
    };
    client = new LDClientImpl('sdk-key', platform, options, makeCallbacks(false));

    // Wait for the client to initialize from the empty test data.
    await client.waitForInitialization({ timeout: 10 });

    // The empty full payload still provides both namespaces, so the persistent store clears
    // the flags and the segments.
    expect(initCalls).toHaveLength(1);
    expect(Object.keys(initCalls[0]).sort()).toEqual(['features', 'segments']);
    expect(initCalls[0].features).toEqual({});
    expect(initCalls[0].segments).toEqual({});
  });
});
