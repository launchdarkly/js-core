import promisify from '../../src/async/promisify';
import defaultHeaders from '../../src/data_sources/defaultHeaders';
import StreamingProcessor from '../../src/data_sources/StreamingProcessor';
import DiagnosticsManager from '../../src/events/DiagnosticsManager';
import Configuration from '../../src/options/Configuration';
import {
  EventSource, EventSourceInitDict, Info, Options, PlatformData, Requests, Response, SdkData,
} from '../../src/platform';
import AsyncStoreFacade from '../../src/store/AsyncStoreFacade';
import InMemoryFeatureStore from '../../src/store/InMemoryFeatureStore';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';
import basicPlatform from '../evaluation/mocks/platform';
import TestLogger, { LogLevel } from '../Logger';
import MockEventSource from '../MockEventSource';

const sdkKey = 'my-sdk-key';

const info: Info = {
  platformData(): PlatformData {
    return {};
  },
  sdkData(): SdkData {
    const sdkData: SdkData = {
      version: '2.2.2',
    };
    return sdkData;
  },
};

function createRequests(cb: (es: MockEventSource) => void): Requests {
  return {
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    fetch(url: string, options?: Options | undefined): Promise<Response> {
      throw new Error('Function not implemented.');
    },
    createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource {
      const es = new MockEventSource(url, eventSourceInitDict);
      cb(es);
      return es;
    },
  };
}

describe('given a stream processor with mock event source', () => {
  let es: MockEventSource;
  let requests: Requests;
  let featureStore: InMemoryFeatureStore;
  let streamProcessor: StreamingProcessor;
  let config: Configuration;
  let asyncStore: AsyncStoreFacade;
  let logger: TestLogger;
  let diagnosticsManager: DiagnosticsManager;

  beforeEach(() => {
    requests = createRequests((nes) => { es = nes; });
    featureStore = new InMemoryFeatureStore();
    asyncStore = new AsyncStoreFacade(featureStore);
    logger = new TestLogger();
    config = new Configuration({
      streamUri: 'http://test',
      baseUri: 'http://base.test',
      eventsUri: 'http://events.test',
      featureStore,
      logger,
    });
    diagnosticsManager = new DiagnosticsManager('sdk-key', config, basicPlatform, featureStore);
    streamProcessor = new StreamingProcessor(
      sdkKey,
      config,
      requests,
      info,
      featureStore,
      diagnosticsManager,
    );
  });

  async function promiseStart() {
    return promisify((cb) => streamProcessor.start(cb));
  }

  function expectJsonError(err: { message?: string }) {
    expect(err).toBeDefined();
    expect(err.message).toEqual('Malformed JSON data in event stream');
    logger.expectMessages([{
      level: LogLevel.Error,
      matches: /Stream received invalid data in/,
    }]);
  }

  it('uses expected URL', () => {
    streamProcessor.start();
    expect(es.url).toEqual(`${config.serviceEndpoints.streaming}/all`);
  });

  it('sets expected headers', () => {
    streamProcessor.start();
    expect(es.options.headers).toMatchObject(defaultHeaders(sdkKey, config, info));
  });

  describe('when putting a message', () => {
    const putData = {
      data: {
        flags: {
          flagkey: { key: 'flagkey', version: 1 },
        },
        segments: {
          segkey: { key: 'segkey', version: 2 },
        },
      },
    };

    it('causes flags and segments to be stored', async () => {
      streamProcessor.start();
      es.handlers.put({ data: JSON.stringify(putData) });
      const initialized = await asyncStore.initialized();
      expect(initialized).toBeTruthy();

      const f = await asyncStore.get(VersionedDataKinds.Features, 'flagkey');
      expect(f?.version).toEqual(1);
      const s = await asyncStore.get(VersionedDataKinds.Segments, 'segkey');
      expect(s?.version).toEqual(2);
    });

    it('calls initialization callback', async () => {
      const promise = promiseStart();
      es.handlers.put({ data: JSON.stringify(putData) });
      expect(await promise).toBeUndefined();
    });

    it('passes error to callback if data is invalid', async () => {
      streamProcessor.start();

      const promise = promiseStart();
      es.handlers.put({ data: '{not-good' });
      const result = await promise;
      expectJsonError(result as any);
    });

    // it('updates diagnostic stats', async () => {
    //   // TODO: When diagnostics are implemented.
    // });
  });

  describe('when patching a message', () => {
    it('updates a patched flag', async () => {
      streamProcessor.start();
      const patchData = {
        path: '/flags/flagkey',
        data: { key: 'flagkey', version: 1 },
      };

      es.handlers.patch({ data: JSON.stringify(patchData) });

      const f = await asyncStore.get(VersionedDataKinds.Features, 'flagkey');
      expect(f!.version).toEqual(1);
    });

    it('updates a patched segment', async () => {
      streamProcessor.start();
      const patchData = {
        path: '/segments/segkey',
        data: { key: 'segkey', version: 1 },
      };

      es.handlers.patch({ data: JSON.stringify(patchData) });

      const s = await asyncStore.get(VersionedDataKinds.Segments, 'segkey');
      expect(s!.version).toEqual(1);
    });

    it('passes error to callback if data is invalid', async () => {
      streamProcessor.start();

      const promise = promiseStart();
      es.handlers.patch({ data: '{not-good' });
      const result = await promise;
      expectJsonError(result as any);
    });
  });

  describe('when deleting a message', () => {
    it('deletes a flag', async () => {
      streamProcessor.start();
      const flag = { key: 'flagkey', version: 1 };
      await asyncStore.upsert(VersionedDataKinds.Features, flag);
      const f = await asyncStore.get(VersionedDataKinds.Features, 'flagkey');
      expect(f!.version).toEqual(1);

      const deleteData = { path: `/flags/${flag.key}`, version: 2 };

      es.handlers.delete({ data: JSON.stringify(deleteData) });

      const f2 = await asyncStore.get(VersionedDataKinds.Features, 'flagkey');
      expect(f2).toBe(null);
    });

    it('deletes a segment', async () => {
      streamProcessor.start();
      const segment = { key: 'segkey', version: 1 };
      await asyncStore.upsert(VersionedDataKinds.Segments, segment);
      const s = await asyncStore.get(VersionedDataKinds.Segments, 'segkey');
      expect(s!.version).toEqual(1);

      const deleteData = { path: `/segments/${segment.key}`, version: 2 };

      es.handlers.delete({ data: JSON.stringify(deleteData) });

      const s2 = await asyncStore.get(VersionedDataKinds.Segments, 'segkey');
      expect(s2).toBe(null);
    });

    it('passes error to callback if data is invalid', async () => {
      streamProcessor.start();

      const promise = promiseStart();
      es.handlers.delete({ data: '{not-good' });
      const result = await promise;
      expectJsonError(result as any);
    });
  });

  describe.each([400, 408, 429, 500, 503, undefined])('given recoverable http errors', (status) => {
    const err = {
      status,
      message: 'sorry',
    };

    it(`continues retrying after error: ${status}`, () => {
      const startTime = Date.now();
      streamProcessor.start();
      es.simulateError(err as any);

      logger.expectMessages([{
        level: LogLevel.Warn,
        matches: status ? new RegExp(`error ${err.status}.*will retry`)
          : /Received I\/O error \(sorry\) for streaming request - will retry/,
      }]);

      const event = diagnosticsManager.createStatsEventAndReset(0, 0, 0);
      expect(event.streamInits.length).toEqual(1);
      const si = event.streamInits[0];
      expect(si.timestamp).toBeGreaterThanOrEqual(startTime);
      expect(si.failed).toBeTruthy();
      expect(si.durationMillis).toBeGreaterThanOrEqual(0);
    });
  });

  describe.each([401, 403])('given unrecoverable http errors', (status) => {
    const startTime = Date.now();
    const err = {
      status,
      message: 'sorry',
    };

    it(`stops retrying after error: ${status}`, () => {
      streamProcessor.start();
      es.simulateError(err as any);

      logger.expectMessages([{
        level: LogLevel.Error,
        matches: /Received error.*giving up permanently/,
      }]);

      const event = diagnosticsManager.createStatsEventAndReset(0, 0, 0);
      expect(event.streamInits.length).toEqual(1);
      const si = event.streamInits[0];
      expect(si.timestamp).toBeGreaterThanOrEqual(startTime);
      expect(si.failed).toBeTruthy();
      expect(si.durationMillis).toBeGreaterThanOrEqual(0);
    });
  });
});
