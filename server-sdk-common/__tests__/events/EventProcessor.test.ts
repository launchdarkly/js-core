/* eslint-disable @typescript-eslint/no-unused-vars */
import { Context } from '@launchdarkly/js-sdk-common';
import EventFactory from '../../src/events/EventFactory';
import EventProcessor from '../../src/events/EventProcessor';
import Configuration from '../../src/options/Configuration';
import {
  EventSource,
  EventSourceInitDict,
  Headers,
  Info,
  Options,
  PlatformData,
  Requests,
  Response,
  SdkData,
} from '../../src/platform';
import { SDK_KEY } from './CustomMatchers';

function makeSummary(start: number, end: number, count: number, version: number): any {
  return {
    endDate: end,
    features: {
      flagkey: {
        contextKinds: [
          'user',
        ],
        counters: [
          {
            count,
            value: 'value',
            variation: 1,
            version,
          },
        ],
        default: 'default',
      },
    },
    kind: 'summary',
    startDate: start,
  };
}

function makeFeatureEvent(
  date: number,
  version: number,
  debug: boolean = false,
  key: string = 'flagkey',
  variation: number = 1,
  def: string = 'default',
  value: string = 'value',
): any {
  return {
    kind: debug ? 'debug' : 'feature',
    key,
    creationDate: date,
    version,
    variation,
    value,
    default: def,
    ...(debug ? {
      context: {
        key: 'userKey',
        name: 'Red',
        kind: 'user',
      },
    } : {
      contextKeys: {
        user: 'userKey',
      },
    })
    ,
  };
}

describe('given an event processor', () => {
  let eventProcessor: EventProcessor;
  let requestsMade: Array<{ url: string, options: Options }>;

  let testHeaders: Record<string, string>;
  let testStatus = 200;

  function resetRequestState() {
    requestsMade = [];
    testHeaders = {};
    testStatus = 200;
  }

  const factory = new EventFactory(true);

  const user = { key: 'userKey', name: 'Red' };
  const userWithFilteredName = {
    key: 'userKey',
    kind: 'user',
    name: 'Red',
    _meta: { privateAttributes: ['name'] },
  };
  const anonUser = { key: 'anon-user', name: 'Anon', anonymous: true };
  const filteredUser = { key: 'userKey', kind: 'user', _meta: { redactedAttributes: ['name'] } };

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

  const requests: Requests = {
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    fetch(url: string, options?: Options): Promise<Response> {
      return new Promise<Response>((a, r) => {
        const headers: Headers = {
          get(name: string): string | null {
            return testHeaders[name] || null;
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
          has(name: string): boolean {
            throw new Error('Function not implemented.');
          },
        };

        const res: Response = {
          headers,
          status: testStatus,
          text(): Promise<string> {
            throw new Error('Function not implemented.');
          },
          json(): Promise<any> {
            throw new Error('Function not implemented.');
          },
        };
        requestsMade.push({ url, options: options! });
        a(res);
      });
    },

    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource {
      throw new Error('Function not implemented.');
    },
  };

  beforeEach(() => {
    resetRequestState();

    const config = new Configuration();

    eventProcessor = new EventProcessor(SDK_KEY, config, info, requests);
  });

  afterEach(() => {
    eventProcessor.close();
  });

  it('queues an identify event', async () => {
    Date.now = jest.fn(() => 1000);
    eventProcessor.sendEvent(factory.identifyEvent(Context.fromLDContext(user)));

    await eventProcessor.flush();

    expect(requestsMade[0]).toMatchEvents([{
      context: { ...user, kind: 'user' },
      creationDate: 1000,
      kind: 'identify',
    }]);
  });

  it('filters user in identify event', async () => {
    Date.now = jest.fn(() => 1000);
    eventProcessor.sendEvent(factory.identifyEvent(Context.fromLDContext(userWithFilteredName)));

    await eventProcessor.flush();

    expect(requestsMade[0]).toMatchEvents([{
      context: { ...filteredUser, kind: 'user' },
      creationDate: 1000,
      kind: 'identify',
    }]);
  });

  it('stringifies user attributes in identify event', async () => {
    Date.now = jest.fn(() => 1000);
    eventProcessor.sendEvent(factory.identifyEvent(Context.fromLDContext({
      key: 1,
      secondary: 2,
      ip: 3,
      country: 4,
      email: 5,
      firstName: 6,
      lastName: 7,
      avatar: 8,
      name: 9,
      anonymous: false,
      custom: { age: 99 },
    } as any)));

    await eventProcessor.flush();

    expect(requestsMade[0]).toMatchEvents([{
      kind: 'identify',
      creationDate: 1000,
      context: {
        kind: 'user',
        key: '1',
        ip: '3',
        country: '4',
        email: '5',
        firstName: '6',
        lastName: '7',
        avatar: '8',
        name: '9',
        age: 99,
        anonymous: false,
        _meta: { secondary: '2' },
      },
    }]);
  });

  it('queues individual feature event with index event', async () => {
    Date.now = jest.fn(() => 1000);
    eventProcessor.sendEvent({
      kind: 'feature',
      creationDate: 1000,
      context: Context.fromLDContext(user),
      key: 'flagkey',
      version: 11,
      variation: 1,
      value: 'value',
      trackEvents: true,
      default: 'default',
    });

    await eventProcessor.flush();

    expect(requestsMade[0]).toMatchEvents([
      {
        kind: 'index',
        creationDate: 1000,
        context: { ...user, kind: 'user' },
      },
      makeFeatureEvent(1000, 11),
      makeSummary(1000, 1000, 1, 11),
    ]);
  });

  it('handles the version being 0', async () => {
    Date.now = jest.fn(() => 1000);
    eventProcessor.sendEvent({
      kind: 'feature',
      creationDate: 1000,
      context: Context.fromLDContext(user),
      key: 'flagkey',
      version: 0,
      variation: 1,
      value: 'value',
      trackEvents: true,
      default: 'default',
    });

    await eventProcessor.flush();

    expect(requestsMade[0]).toMatchEvents([
      {
        kind: 'index',
        creationDate: 1000,
        context: { ...user, kind: 'user' },
      },
      makeFeatureEvent(1000, 0),
      makeSummary(1000, 1000, 1, 0),
    ]);
  });

  it('sets event kind to debug if event is temporarily in debug mode', async () => {
    Date.now = jest.fn(() => 1000);
    eventProcessor.sendEvent({
      kind: 'feature',
      creationDate: 1000,
      context: Context.fromLDContext(user),
      key: 'flagkey',
      version: 11,
      variation: 1,
      value: 'value',
      trackEvents: false,
      debugEventsUntilDate: 2000,
      default: 'default',
    });

    await eventProcessor.flush();

    expect(requestsMade[0]).toMatchEvents([
      {
        kind: 'index',
        creationDate: 1000,
        context: { ...user, kind: 'user' },
      },
      makeFeatureEvent(1000, 11, true),
      makeSummary(1000, 1000, 1, 11),
    ]);
  });

  it('can both track and debug an event', async () => {
    Date.now = jest.fn(() => 1000);
    eventProcessor.sendEvent({
      kind: 'feature',
      creationDate: 1000,
      context: Context.fromLDContext(user),
      key: 'flagkey',
      version: 11,
      variation: 1,
      value: 'value',
      trackEvents: true,
      debugEventsUntilDate: 2000,
      default: 'default',
    });

    await eventProcessor.flush();

    expect(requestsMade[0]).toMatchEvents([
      {
        kind: 'index',
        creationDate: 1000,
        context: { ...user, kind: 'user' },
      },
      makeFeatureEvent(1000, 11, false),
      makeFeatureEvent(1000, 11, true),
      makeSummary(1000, 1000, 1, 11),
    ]);
  });

  it('expires debug mode based on client time if client time is later than server time', async () => {
    Date.now = jest.fn(() => 2000);
    testHeaders.date = new Date(1000).toUTCString();

    eventProcessor.sendEvent({
      kind: 'feature',
      creationDate: 1400,
      context: Context.fromLDContext(user),
      key: 'flagkey',
      version: 11,
      variation: 1,
      value: 'value',
      trackEvents: false,
      debugEventsUntilDate: 1500,
      default: 'default',
    });

    await eventProcessor.flush();

    expect(requestsMade[0]).toMatchEvents([
      {
        kind: 'index',
        creationDate: 1400,
        context: { ...user, kind: 'user' },
      },
      makeSummary(1400, 1400, 1, 11),
    ]);
  });

  it('expires debug mode based on server time if server time is later than client time', async () => {
    Date.now = jest.fn(() => 1000);
    testHeaders.date = new Date(2000).toUTCString();

    eventProcessor.sendEvent(factory.identifyEvent(Context.fromLDContext(user)));

    await eventProcessor.flush();

    eventProcessor.sendEvent({
      kind: 'feature',
      creationDate: 1400,
      context: Context.fromLDContext(user),
      key: 'flagkey',
      version: 11,
      variation: 1,
      value: 'value',
      trackEvents: false,
      debugEventsUntilDate: 1500,
      default: 'default',
    });

    await eventProcessor.flush();

    expect(requestsMade[1]).toMatchEvents([
      makeSummary(1400, 1400, 1, 11),
    ]);
  });

  it('generates only one index event from two feature events for same user', async () => {
    Date.now = jest.fn(() => 1000);

    const context = Context.fromLDContext(user);
    eventProcessor.sendEvent({
      kind: 'feature',
      creationDate: 1000,
      context,
      key: 'flagkey1',
      version: 11,
      variation: 1,
      value: 'value',
      trackEvents: true,
      default: 'default',
    });
    eventProcessor.sendEvent({
      kind: 'feature',
      creationDate: 1000,
      context,
      key: 'flagkey2',
      version: 22,
      variation: 3,
      value: 'carrot',
      trackEvents: true,
      default: 'potato',
    });

    await eventProcessor.flush();

    expect(requestsMade[0]).toMatchEvents([
      {
        kind: 'index',
        creationDate: 1000,
        context: { ...user, kind: 'user' },
      },
      makeFeatureEvent(1000, 11, false, 'flagkey1'),
      makeFeatureEvent(1000, 22, false, 'flagkey2', 3, 'potato', 'carrot'),
      {
        endDate: 1000,
        features: {
          flagkey1: {
            contextKinds: [
              'user',
            ],
            counters: [
              {
                count: 1,
                value: 'value',
                variation: 1,
                version: 11,
              },
            ],
            default: 'default',
          },

          flagkey2: {
            contextKinds: [
              'user',
            ],
            counters: [
              {
                count: 1,
                value: 'carrot',
                variation: 3,
                version: 22,
              },
            ],
            default: 'potato',
          },
        },
        kind: 'summary',
        startDate: 1000,
      },
    ]);
  });

  it('summarizes nontracked events', async () => {
    Date.now = jest.fn(() => 1000);

    const context = Context.fromLDContext(user);
    eventProcessor.sendEvent({
      kind: 'feature',
      creationDate: 1000,
      context,
      key: 'flagkey1',
      version: 11,
      variation: 1,
      value: 'value',
      trackEvents: false,
      default: 'default',
    });
    eventProcessor.sendEvent({
      kind: 'feature',
      creationDate: 1000,
      context,
      key: 'flagkey2',
      version: 22,
      variation: 3,
      value: 'carrot',
      trackEvents: false,
      default: 'potato',
    });

    await eventProcessor.flush();

    expect(requestsMade[0]).toMatchEvents([
      {
        kind: 'index',
        creationDate: 1000,
        context: { ...user, kind: 'user' },
      },
      {
        endDate: 1000,
        features: {
          flagkey1: {
            contextKinds: [
              'user',
            ],
            counters: [
              {
                count: 1,
                value: 'value',
                variation: 1,
                version: 11,
              },
            ],
            default: 'default',
          },

          flagkey2: {
            contextKinds: [
              'user',
            ],
            counters: [
              {
                count: 1,
                value: 'carrot',
                variation: 3,
                version: 22,
              },
            ],
            default: 'potato',
          },
        },
        kind: 'summary',
        startDate: 1000,
      },
    ]);
  });

  it('queues custom event with user', async () => {
    Date.now = jest.fn(() => 1000);
    eventProcessor.sendEvent({
      kind: 'custom',
      creationDate: 1000,
      context: Context.fromLDContext(user),
      key: 'eventkey',
      data: { thing: 'stuff' },
    });

    await eventProcessor.flush();

    expect(requestsMade[0]).toMatchEvents([
      {
        kind: 'index',
        creationDate: 1000,
        context: { ...user, kind: 'user' },
      },
      {
        kind: 'custom',
        key: 'eventkey',
        data: { thing: 'stuff' },
        creationDate: 1000,
        contextKeys: {
          user: 'userKey',
        },
      },
    ]);
  });

  it('queues custom event with anonymous user', async () => {
    eventProcessor.sendEvent({
      kind: 'custom',
      creationDate: 1000,
      context: Context.fromLDContext(anonUser),
      key: 'eventkey',
      data: { thing: 'stuff' },
    });

    await eventProcessor.flush();

    expect(requestsMade[0]).toMatchEvents([
      {
        kind: 'index',
        creationDate: 1000,
        context: { ...anonUser, kind: 'user' },
      },
      {
        kind: 'custom',
        key: 'eventkey',
        data: { thing: 'stuff' },
        creationDate: 1000,
        contextKeys: {
          user: 'anon-user',
        },
      },
    ]);
  });

  it('can include metric value in custom event', async () => {
    Date.now = jest.fn(() => 1000);
    eventProcessor.sendEvent({
      kind: 'custom',
      creationDate: 1000,
      context: Context.fromLDContext(user),
      key: 'eventkey',
      data: { thing: 'stuff' },
      metricValue: 1.5,
    });

    await eventProcessor.flush();

    expect(requestsMade[0]).toMatchEvents([
      {
        kind: 'index',
        creationDate: 1000,
        context: { ...user, kind: 'user' },
      },
      {
        kind: 'custom',
        key: 'eventkey',
        data: { thing: 'stuff' },
        creationDate: 1000,
        contextKeys: {
          user: 'userKey',
        },
        metricValue: 1.5,
      },
    ]);
  });

  it('it makes no network requests if there are no events to flush', async () => {
    eventProcessor.flush();
    expect(requestsMade.length).toEqual(0);
  });

  it('sends unique payload ids', async () => {
    Date.now = jest.fn(() => 1000);
    eventProcessor.sendEvent(factory.identifyEvent(Context.fromLDContext(user)));

    await eventProcessor.flush();
    eventProcessor.sendEvent(factory.identifyEvent(Context.fromLDContext(user)));

    await eventProcessor.flush();

    const headers1 = requestsMade[0].options.headers!;
    const headers2 = requestsMade[1].options.headers!;

    expect(headers1['x-launchdarkly-payload-id']).not.toEqual(headers2['x-launchdarkly-payload-id']);
  });

  describe.each([400, 408, 429, 503])('given recoverable errors', (status) => {
    it(`retries - ${status}`, async () => {
      testStatus = status;
      eventProcessor.sendEvent(factory.identifyEvent(Context.fromLDContext(user)));
      await expect(eventProcessor.flush()).rejects.toThrow(`error ${status}`);
      expect(requestsMade.length).toEqual(2);

      expect(requestsMade[0]).toEqual(requestsMade[1]);
    });
  });

  describe.each([401, 403])('given unrecoverable errors', (status) => {
    it(`does not retry - ${status}`, async () => {
      testStatus = status;
      eventProcessor.sendEvent(factory.identifyEvent(Context.fromLDContext(user)));
      await expect(eventProcessor.flush()).rejects.toThrow(`error ${status}`);
      expect(requestsMade.length).toEqual(1);

      eventProcessor.sendEvent(factory.identifyEvent(Context.fromLDContext(user)));
      await expect(eventProcessor.flush()).rejects.toThrow(/SDK key is invalid/);
    });
  });

  it('swallows errors from failed background flush', async () => {
    const config = new Configuration({ flushInterval: 0.1 });

    testStatus = 500;

    eventProcessor.close();
    eventProcessor = new EventProcessor(SDK_KEY, config, info, requests);
    eventProcessor.sendEvent(factory.identifyEvent(Context.fromLDContext(user)));

    // Need to wait long enough for the retry.
    await new Promise((r) => { setTimeout(r, 1500); });
    expect(requestsMade.length).toEqual(2);
  });
});
