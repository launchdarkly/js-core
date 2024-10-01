import {
  ClientContext,
  Context,
  EventSource,
  EventSourceInitDict,
  Hasher,
  Headers,
  Hmac,
  Info,
  internal,
  Options,
  PlatformData,
  Requests,
  Response,
  SdkData,
} from '@launchdarkly/js-sdk-common';

import ContextDeduplicator from '../../src/events/ContextDeduplicator';
import Configuration from '../../src/options/Configuration';
import InMemoryFeatureStore from '../../src/store/InMemoryFeatureStore';
import { createBasicPlatform } from '../createBasicPlatform';

let mockPlatform: ReturnType<typeof createBasicPlatform>;

beforeEach(() => {
  mockPlatform = createBasicPlatform();
});

const SDK_KEY = 'sdk-key';

interface RequestState {
  testHeaders: Record<string, string>;
  testStatus: number;
  requestsMade: Array<{ url: string; options: Options }>;
}

function makePlatform(requestState: RequestState) {
  const info: Info = {
    platformData(): PlatformData {
      return {
        os: {
          name: 'An OS',
          version: '1.0.1',
          arch: 'An Arch',
        },
        name: 'The SDK Name',
        additional: {
          nodeVersion: '42',
        },
      };
    },
    sdkData(): SdkData {
      return {
        name: 'An SDK',
        version: '2.0.2',
      };
    },
  };

  const waiters: Array<() => void> = [];
  let callCount = 0;
  const waitForMessages = async (count: number) =>
    new Promise<number>((resolve) => {
      const waiter = () => {
        if (callCount >= count) {
          resolve(callCount);
        }
      };
      waiter();
      waiters.push(waiter);
    });

  const requests: Requests = {
    fetch(url: string, options?: Options): Promise<Response> {
      return new Promise<Response>((a) => {
        const headers: Headers = {
          get(name: string): string | null {
            return requestState.testHeaders[name] || null;
          },
          keys(): Iterable<string> {
            throw new Error('Function not implemented.');
          },
          values(): Iterable<string> {
            throw new Error('Function not implemented.');
          },
          entries(): Iterable<[string, string]> {
            throw new Error('Function not implemented.');
          },
          has(_name: string): boolean {
            throw new Error('Function not implemented.');
          },
        };

        const res: Response = {
          headers,
          status: requestState.testStatus,
          text(): Promise<string> {
            throw new Error('Function not implemented.');
          },
          json(): Promise<any> {
            throw new Error('Function not implemented.');
          },
        };
        requestState.requestsMade.push({ url, options: options! });
        callCount += 1;
        waiters.forEach((waiter) => waiter());
        a(res);
      });
    },

    createEventSource(_url: string, _eventSourceInitDict: EventSourceInitDict): EventSource {
      throw new Error('Function not implemented.');
    },
    getEventSourceCapabilities() {
      throw new Error('Function not implemented.');
    },
  };
  return {
    info,
    requests,
    waitForMessages,
    crypto: {
      createHash(algorithm: string): Hasher {
        // Not used for this test.
        throw new Error(`Function not implemented.${algorithm}`);
      },
      createHmac(algorithm: string, key: string): Hmac {
        // Not used for this test.
        throw new Error(`Function not implemented.${algorithm}${key}`);
      },
      randomUUID: () => '9-ypf7NswGfZ3CN2WpTix',
    },
  };
}

const user = { key: 'userKey', name: 'Red' };

describe('given an event processor with diagnostics manager', () => {
  let eventProcessor: internal.EventProcessor;

  const requestState: RequestState = {
    requestsMade: [],
    testHeaders: {},
    testStatus: 200,
  };

  function resetRequestState() {
    requestState.requestsMade = [];
    requestState.testHeaders = {};
    requestState.testStatus = 200;
  }

  let info: Info;
  let requests: Requests;

  /**
   * Wait for the total messages sent to be at least count.
   */
  let waitForMessages: (count: number) => Promise<number>;

  beforeEach(() => {
    const platform = makePlatform(requestState);

    info = platform.info;
    requests = platform.requests;
    const { crypto } = platform;
    waitForMessages = platform.waitForMessages;

    resetRequestState();
    jest.spyOn(Date, 'now').mockImplementation(() => 1000);

    const store = new InMemoryFeatureStore();
    const config = new Configuration({ capacity: 3, featureStore: store });

    // Cannot create a config with the recording interval this short, so
    // we need to make an object and replace the value.
    const testConfig = { ...config, diagnosticRecordingInterval: 0.1 };

    const diagnosticsManager = new internal.DiagnosticsManager(
      'sdk-key',
      {
        ...mockPlatform,
        // Replace info and requests.
        info,
        requests,
        crypto,
      },
      {
        config1: 'test',
      },
    );

    const clientContext = new ClientContext(SDK_KEY, testConfig, {
      ...mockPlatform,
      info,
      requests,
    });

    eventProcessor = new internal.EventProcessor(
      testConfig,
      clientContext,
      {},
      new ContextDeduplicator(config),
      diagnosticsManager,
    );
  });

  afterEach(() => {
    eventProcessor.close();
    jest.resetAllMocks();
  });

  it('sends initial diagnostic event', () => {
    expect(requestState.requestsMade.length).toEqual(1);
    expect(JSON.parse(requestState.requestsMade[0].options.body!)).toEqual({
      configuration: {
        config1: 'test',
      },
      creationDate: 1000,
      id: {
        diagnosticId: '9-ypf7NswGfZ3CN2WpTix',
        sdkKeySuffix: 'dk-key',
      },
      kind: 'diagnostic-init',
      platform: {
        name: 'The SDK Name',
        osName: 'An OS',
        osVersion: '1.0.1',
        osArch: 'An Arch',
        nodeVersion: '42',
      },
      sdk: {
        name: 'An SDK',
        version: '2.0.2',
      },
    });
  });

  it('sends periodic diagnostic event', async () => {
    let count = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      const inCount = count;
      count += 1;
      if (inCount === 0) {
        return 2000;
      }
      if (inCount === 1) {
        return 3000;
      }
      return 4000;
    });

    await waitForMessages(3);

    const diag1 = requestState.requestsMade[1];
    const diag2 = requestState.requestsMade[2];
    expect(diag1.url).toContain('/diagnostic');
    expect(diag2.url).toContain('/diagnostic');

    const data = JSON.parse(diag1.options.body!);
    expect(data.kind).toEqual('diagnostic');
    expect(data.id).toEqual({
      diagnosticId: '9-ypf7NswGfZ3CN2WpTix',
      sdkKeySuffix: 'dk-key',
    });
    expect(data.creationDate).toEqual(2000);
    expect(data.dataSinceDate).toEqual(1000);

    expect(data.droppedEvents).toEqual(0);
    expect(data.deduplicatedUsers).toEqual(0);
    expect(data.eventsInLastBatch).toEqual(0);

    const data2 = JSON.parse(diag2.options.body!);
    expect(data2.kind).toEqual('diagnostic');
    expect(data2.id).toEqual({
      diagnosticId: '9-ypf7NswGfZ3CN2WpTix',
      sdkKeySuffix: 'dk-key',
    });
    expect(data2.creationDate).toEqual(3000);
    expect(data2.dataSinceDate).toEqual(2000);

    expect(data2.droppedEvents).toEqual(0);
    expect(data2.deduplicatedUsers).toEqual(0);
    expect(data2.eventsInLastBatch).toEqual(0);
  });

  it('counts events in queue from last flush and dropped events', async () => {
    const context = Context.fromLDContext(user);
    eventProcessor.sendEvent({ kind: 'identify', creationDate: 1000, context, samplingRatio: 1 });
    eventProcessor.sendEvent({ kind: 'identify', creationDate: 1001, context, samplingRatio: 1 });
    eventProcessor.sendEvent({ kind: 'identify', creationDate: 1002, context, samplingRatio: 1 });
    eventProcessor.sendEvent({ kind: 'identify', creationDate: 1003, context, samplingRatio: 1 });
    await eventProcessor.flush();

    await waitForMessages(3);

    const eventMessage = requestState.requestsMade.find((msg) => msg.url.endsWith('/bulk'));
    expect(eventMessage).toBeDefined();
    const eventMessageData = JSON.parse(eventMessage!.options.body!);
    expect(eventMessageData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'identify', creationDate: 1000 }),
        expect.objectContaining({ kind: 'identify', creationDate: 1001 }),
        expect.objectContaining({ kind: 'identify', creationDate: 1002 }),
      ]),
    );

    const diagnosticMessage = requestState.requestsMade.find(
      (msg, idx) => idx !== 0 && msg.url.endsWith('/diagnostic'),
    );
    expect(diagnosticMessage).toBeDefined();
    const diagnosticMessageData = JSON.parse(diagnosticMessage!.options.body!);
    expect(diagnosticMessageData).toEqual(
      expect.objectContaining({
        kind: 'diagnostic',
        id: {
          diagnosticId: '9-ypf7NswGfZ3CN2WpTix',
          sdkKeySuffix: 'dk-key',
        },
        droppedEvents: 1,
        deduplicatedUsers: 0,
        eventsInLastBatch: 3,
      }),
    );
  });

  it('counts de-duplicated users', async () => {
    const context = Context.fromLDContext(user);
    eventProcessor.sendEvent({
      kind: 'custom',
      key: 'eventkey1',
      creationDate: 1000,
      context,
      samplingRatio: 1,
    });
    eventProcessor.sendEvent({
      kind: 'custom',
      key: 'eventkey2',
      creationDate: 1001,
      context,
      samplingRatio: 1,
    });
    await eventProcessor.flush();

    await waitForMessages(4);

    const eventMessage = requestState.requestsMade.find((msg) => msg.url.endsWith('/bulk'));
    expect(eventMessage).toBeDefined();
    const eventMessageData = JSON.parse(eventMessage!.options.body!);
    expect(eventMessageData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'custom', creationDate: 1000 }),
        expect.objectContaining({ kind: 'custom', creationDate: 1001 }),
      ]),
    );

    const diagnosticMessage = requestState.requestsMade.find(
      (msg, idx) => idx !== 0 && msg.url.endsWith('/diagnostic'),
    );
    expect(diagnosticMessage).toBeDefined();
    const diagnosticMessageData = JSON.parse(diagnosticMessage!.options.body!);
    expect(diagnosticMessageData).toEqual(
      expect.objectContaining({
        kind: 'diagnostic',
        id: {
          diagnosticId: '9-ypf7NswGfZ3CN2WpTix',
          sdkKeySuffix: 'dk-key',
        },
        droppedEvents: 0,
        deduplicatedUsers: 1,
        eventsInLastBatch: 3,
      }),
    );
  });
});
