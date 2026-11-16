import { CustomDataSourceOptions } from '../src/api/options/LDDataSystemOptions';
import LDClientImpl from '../src/LDClientImpl';
import InMemoryFeatureStore from '../src/store/InMemoryFeatureStore';
import MockFilesystem from './data_sources/filedata/MockFilesystem';
import makeMockLogger from './mockLogger';
import {
  fdv2FullPayload,
  makeCallbacks,
  makeFDv2Client,
  makeFDv2Platform,
  singleValueFlag,
} from './overrides/overridesTestSupport';
import waitFor from './waitFor';

function fullPayload(state: string, empty = false): string {
  const body = JSON.parse(fdv2FullPayload(empty ? {} : { flag: singleValueFlag('flag', true) }));
  body.events[0].data.payloads[0] = { id: state, target: 0, intentCode: 'xfer-full' };
  body.events[body.events.length - 1].data = { state, version: 0 };
  return JSON.stringify(body);
}

function response(body: string, status = 200) {
  return { status, headers: new Headers(), text: async () => body };
}

describe('FDv2 selectorless readiness', () => {
  let client: LDClientImpl;
  const callbacks = makeCallbacks();

  afterEach(() => {
    client?.close();
    jest.clearAllMocks();
  });

  const createClient = (
    platform: ReturnType<typeof makeFDv2Platform>,
    dataSource: CustomDataSourceOptions,
    persistentStore?: InMemoryFeatureStore,
  ) => {
    client = makeFDv2Client(
      platform,
      {
        logger: makeMockLogger(),
        dataSystem: { dataSource, fdv1Fallback: null, persistentStore },
      },
      callbacks,
    );
  };

  it.each(['polling', 'file'])(
    'applies selectorless %s initializer data, continues initialization, and becomes ready at exhaustion',
    async (firstType) => {
      const filesystem = new MockFilesystem();
      filesystem.set('/flags.json', JSON.stringify({ flagValues: { flag: true } }));
      const platform = { ...makeFDv2Platform(), fileSystem: filesystem };
      let finishSecond: (value: ReturnType<typeof response>) => void;
      platform.requests.fetch = jest.fn((url: string) => {
        if (url.startsWith('http://first')) return Promise.resolve(response(fullPayload('')));
        if (url.startsWith('http://second')) {
          return new Promise<ReturnType<typeof response>>((resolve) => {
            finishSecond = resolve;
          });
        }
        return new Promise(() => {});
      });
      createClient(platform, {
        dataSourceOptionsType: 'custom',
        initializers: [
          firstType === 'file'
            ? { type: 'file', paths: ['/flags.json'] }
            : { type: 'polling', baseUri: 'http://first' },
          { type: 'polling', baseUri: 'http://second' },
        ],
        synchronizers: [{ type: 'polling', baseUri: 'http://sync' }],
      });

      await waitFor(() =>
        platform.requests.fetch.mock.calls.some(([url]) => url.startsWith('http://second')),
      );
      expect(await client.boolVariation('flag', { key: 'user' }, false)).toBe(true);
      expect(callbacks.onReady).not.toHaveBeenCalled();

      finishSecond!(response('', 503));
      await client.waitForInitialization({ timeout: 1 });
      expect(callbacks.onReady).toHaveBeenCalledTimes(1);
      expect(
        platform.requests.fetch.mock.calls.some(([url]) => url.startsWith('http://sync')),
      ).toBe(true);
    },
  );

  it('ends initialization immediately when an initializer supplies a selector', async () => {
    const platform = makeFDv2Platform(fullPayload('basis'));
    createClient(platform, {
      dataSourceOptionsType: 'custom',
      initializers: [
        { type: 'polling', baseUri: 'http://first' },
        { type: 'polling', baseUri: 'http://second' },
      ],
      synchronizers: [],
    });
    await client.waitForInitialization({ timeout: 1 });
    expect(
      platform.requests.fetch.mock.calls.some(([url]) => url.startsWith('http://second')),
    ).toBe(false);
    expect(callbacks.onReady).toHaveBeenCalledTimes(1);
  });

  it.each(['', 'basis'])(
    'becomes ready from an empty full synchronizer payload with state %j',
    async (state) => {
      createClient(makeFDv2Platform(fullPayload(state, true)), {
        dataSourceOptionsType: 'custom',
        initializers: [],
        synchronizers: [{ type: 'polling' }],
      });
      await client.waitForInitialization({ timeout: 1 });
      expect(client.initialized()).toBe(true);
      expect(callbacks.onReady).toHaveBeenCalledTimes(1);
    },
  );

  it('becomes ready from selectorless synchronizer data and applies it', async () => {
    createClient(makeFDv2Platform(fullPayload('')), {
      dataSourceOptionsType: 'custom',
      initializers: [],
      synchronizers: [{ type: 'polling' }],
    });
    await client.waitForInitialization({ timeout: 1 });
    expect(await client.boolVariation('flag', { key: 'user' }, false)).toBe(true);
  });

  it.each([false, true])(
    'becomes ready with only a file initializer (empty: %s)',
    async (empty) => {
      const filesystem = new MockFilesystem();
      filesystem.set('/flags.json', JSON.stringify({ flagValues: empty ? {} : { flag: true } }));
      createClient(
        { ...makeFDv2Platform(), fileSystem: filesystem } as ReturnType<typeof makeFDv2Platform>,
        {
          dataSourceOptionsType: 'custom',
          initializers: [{ type: 'file', paths: ['/flags.json'] }],
          synchronizers: [],
        },
      );
      await client.waitForInitialization({ timeout: 1 });
      expect(client.initialized()).toBe(true);
      expect(callbacks.onReady).toHaveBeenCalledTimes(1);
      expect(await client.boolVariation('flag', { key: 'user' }, false)).toBe(!empty);
    },
  );

  it('does not become ready when initializers fail and the synchronizer has supplied no data', async () => {
    const platform = makeFDv2Platform();
    platform.requests.fetch = jest.fn((url: string) =>
      url.startsWith('http://failed') ? Promise.resolve(response('', 503)) : new Promise(() => {}),
    );
    createClient(platform, {
      dataSourceOptionsType: 'custom',
      initializers: [{ type: 'polling', baseUri: 'http://failed' }],
      synchronizers: [{ type: 'polling', baseUri: 'http://sync' }],
    });
    await waitFor(() =>
      platform.requests.fetch.mock.calls.some(([url]) => url.startsWith('http://sync')),
    );
    expect(client.initialized()).toBe(false);
    expect(callbacks.onReady).not.toHaveBeenCalled();
  });

  it('does not become ready at initializer exhaustion from an initialized persistent store alone', async () => {
    const persistentStore = new InMemoryFeatureStore();
    persistentStore.init(
      { features: { flag: singleValueFlag('flag', true) }, segments: {} },
      () => {},
    );
    const platform = makeFDv2Platform();
    platform.requests.fetch = jest.fn((url: string) =>
      url.startsWith('http://failed') ? Promise.resolve(response('', 503)) : new Promise(() => {}),
    );
    createClient(
      platform,
      {
        dataSourceOptionsType: 'custom',
        initializers: [{ type: 'polling', baseUri: 'http://failed' }],
        synchronizers: [{ type: 'polling', baseUri: 'http://sync' }],
      },
      persistentStore,
    );
    await waitFor(() =>
      platform.requests.fetch.mock.calls.some(([url]) => url.startsWith('http://sync')),
    );
    expect(callbacks.onReady).not.toHaveBeenCalled();
  });
});
