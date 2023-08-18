/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable class-methods-use-this */

/* eslint-disable max-classes-per-file */
import { AsyncQueue } from 'launchdarkly-js-test-helpers';

import {
  ClientContext,
  Context,
  EventSource,
  EventSourceInitDict,
  Hasher,
  Hmac,
  Options,
  Platform,
  PlatformData,
  Response,
  SdkData,
  ServiceEndpoints,
} from '../../../src';
import {
  LDContextDeduplicator,
  LDDeliveryStatus,
  LDEventSender,
  LDEventSenderResult,
  LDEventType,
} from '../../../src/api/subsystem';
import { EventProcessor, InputIdentifyEvent } from '../../../src/internal';
import { EventProcessorOptions } from '../../../src/internal/events/EventProcessor';
import shouldSample from '../../../src/internal/events/sampling';

jest.mock('../../../src/internal/events/sampling', () => {
  return {
    __esModule: true,
    default: jest.fn(() => true),
  };
});

const user = { key: 'userKey', name: 'Red' };
const userWithFilteredName = {
  key: 'userKey',
  kind: 'user',
  name: 'Red',
  _meta: { privateAttributes: ['name'] },
};
const anonUser = { key: 'anon-user', name: 'Anon', anonymous: true };
const filteredUser = { key: 'userKey', kind: 'user', _meta: { redactedAttributes: ['name'] } };

function makeSummary(start: number, end: number, count: number, version: number): any {
  return {
    endDate: end,
    features: {
      flagkey: {
        contextKinds: ['user'],
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
    ...(debug
      ? {
          context: {
            key: 'userKey',
            name: 'Red',
            kind: 'user',
          },
        }
      : {
          contextKeys: {
            user: 'userKey',
          },
        }),
  };
}

class MockEventSender implements LDEventSender {
  public queue: AsyncQueue<{ type: LDEventType; data: any }> = new AsyncQueue();

  public results: LDEventSenderResult[] = [];

  public defaultResult: LDEventSenderResult = {
    status: LDDeliveryStatus.Succeeded,
  };

  async sendEventData(type: LDEventType, data: any): Promise<LDEventSenderResult> {
    this.queue.add({ type, data });
    return this.results.length ? this.results.shift()! : this.defaultResult;
  }
}

class MockContextDeduplicator implements LDContextDeduplicator {
  flushInterval?: number | undefined = 0.1;

  seen: string[] = [];

  processContext(context: Context): boolean {
    if (this.seen.indexOf(context.canonicalKey) >= 0) {
      return false;
    }
    this.seen.push(context.canonicalKey);
    return true;
  }

  flush(): void {}
}

describe('given an event processor', () => {
  let eventProcessor: EventProcessor;

  let eventSender: MockEventSender;
  let contextDeduplicator: MockContextDeduplicator;

  const eventProcessorConfig: EventProcessorOptions = {
    allAttributesPrivate: false,
    privateAttributes: [],
    eventsCapacity: 1000,
    flushInterval: 300,
    diagnosticRecordingInterval: 900,
  };

  const basicConfiguration = {
    offline: false,
    serviceEndpoints: new ServiceEndpoints('', '', ''),
  };

  const platform: Platform = {
    info: {
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
    },
    crypto: {
      createHash(algorithm: string): Hasher {
        throw new Error('Function not implemented');
      },
      createHmac(algorithm: string, key: string): Hmac {
        // Not used for this test.
        throw new Error('Function not implemented.');
      },
      randomUUID(): string {
        // Not used for this test.
        throw new Error(`Function not implemented.`);
      },
    },
    requests: {
      /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
      fetch(url: string, options?: Options): Promise<Response> {
        throw new Error('Function not implemented.');
      },

      /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
      createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource {
        throw new Error('Function not implemented.');
      },
    },
  };

  beforeEach(() => {
    eventSender = new MockEventSender();
    contextDeduplicator = new MockContextDeduplicator();
    // @ts-ignore
    shouldSample.mockImplementation(() => true);

    eventProcessor = new EventProcessor(
      eventProcessorConfig,
      new ClientContext('sdk-key', basicConfiguration, platform),
      eventSender,
      contextDeduplicator,
    );
  });

  afterEach(() => {
    eventProcessor.close();
  });

  it('queues an identify event', async () => {
    Date.now = jest.fn(() => 1000);
    eventProcessor.sendEvent(new InputIdentifyEvent(Context.fromLDContext(user)));

    await eventProcessor.flush();

    const request = await eventSender.queue.take();

    expect(request.data[0].context).toEqual({ ...user, kind: 'user' });
    expect(request.data[0].creationDate).toEqual(1000);
    expect(request.data[0].kind).toEqual('identify');
    expect(request.type).toEqual(LDEventType.AnalyticsEvents);
  });

  it('filters user in identify event', async () => {
    Date.now = jest.fn(() => 1000);
    eventProcessor.sendEvent(new InputIdentifyEvent(Context.fromLDContext(userWithFilteredName)));

    await eventProcessor.flush();

    const request = await eventSender.queue.take();
    expect(request.data[0].context).toEqual({ ...filteredUser, kind: 'user' });
    expect(request.data[0].creationDate).toEqual(1000);
    expect(request.data[0].kind).toEqual('identify');
    expect(request.type).toEqual(LDEventType.AnalyticsEvents);
  });

  it('stringifies user attributes in identify event', async () => {
    Date.now = jest.fn(() => 1000);
    eventProcessor.sendEvent(
      new InputIdentifyEvent(
        Context.fromLDContext({
          key: 1,
          ip: 3,
          country: 4,
          email: 5,
          firstName: 6,
          lastName: 7,
          avatar: 8,
          name: 9,
          anonymous: false,
          custom: { age: 99 },
        } as any),
      ),
    );

    await eventProcessor.flush();
    const request = await eventSender.queue.take();
    expect(request.data[0].context).toEqual({
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
    });
    expect(request.data[0].creationDate).toEqual(1000);
    expect(request.data[0].kind).toEqual('identify');
    expect(request.type).toEqual(LDEventType.AnalyticsEvents);
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
      samplingRatio: 1,
      indexSamplingRatio: 1,
      withReasons: true,
    });

    await eventProcessor.flush();
    const request = await eventSender.queue.take();

    expect(request.data).toEqual([
      {
        kind: 'index',
        creationDate: 1000,
        context: { ...user, kind: 'user' },
      },
      makeFeatureEvent(1000, 11),
      makeSummary(1000, 1000, 1, 11),
    ]);
  });

  it('uses sampling ratio for feature events', async () => {
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
      samplingRatio: 2,
      indexSamplingRatio: 1, // Disable the index events.
      withReasons: true,
    });

    await eventProcessor.flush();
    const request = await eventSender.queue.take();
    expect(shouldSample).toHaveBeenCalledWith(2);

    expect(request.data).toEqual([
      {
        kind: 'index',
        creationDate: 1000,
        context: { ...user, kind: 'user' },
      },
      { ...makeFeatureEvent(1000, 11), samplingRatio: 2 },
      makeSummary(1000, 1000, 1, 11),
    ]);
  });

  it('excludes feature events that are not sampled', async () => {
    // @ts-ignore
    shouldSample.mockImplementation((ratio) => (ratio === 2 ? false : true));
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
      samplingRatio: 2,
      indexSamplingRatio: 1, // Disable the index events.
      withReasons: true,
    });

    await eventProcessor.flush();
    const request = await eventSender.queue.take();
    expect(shouldSample).toHaveBeenCalledWith(2);
    expect(shouldSample).toHaveBeenCalledWith(1);

    expect(request.data).toEqual([
      {
        kind: 'index',
        creationDate: 1000,
        context: { ...user, kind: 'user' },
      },
      makeSummary(1000, 1000, 1, 11),
    ]);
  });

  it('excludes index events that are not sampled', async () => {
    // @ts-ignore
    shouldSample.mockImplementation((ratio) => (ratio === 2 ? true : false));
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
      samplingRatio: 2,
      indexSamplingRatio: 1, // Disable the index events.
      withReasons: true,
    });

    await eventProcessor.flush();
    const request = await eventSender.queue.take();
    expect(shouldSample).toHaveBeenCalledWith(2);
    expect(shouldSample).toHaveBeenCalledWith(1);

    expect(request.data).toEqual([
      { ...makeFeatureEvent(1000, 11), samplingRatio: 2 },
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
      samplingRatio: 1,
      indexSamplingRatio: 1,
      withReasons: true,
    });

    await eventProcessor.flush();

    const request = await eventSender.queue.take();

    expect(request.data).toEqual([
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
      samplingRatio: 1,
      indexSamplingRatio: 1,
      withReasons: true,
    });

    await eventProcessor.flush();

    const request = await eventSender.queue.take();
    expect(request.data).toEqual([
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
      samplingRatio: 1,
      indexSamplingRatio: 1,
      withReasons: true,
    });

    await eventProcessor.flush();

    const request = await eventSender.queue.take();
    expect(request.data).toEqual([
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

    eventSender.defaultResult = {
      status: LDDeliveryStatus.Succeeded,
      serverTime: new Date(1000).getTime(),
    };

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
      samplingRatio: 1,
      indexSamplingRatio: 1,
      withReasons: true,
    });

    await eventProcessor.flush();

    const request = await eventSender.queue.take();
    expect(request.data).toEqual([
      {
        kind: 'index',
        creationDate: 1400,
        context: { ...user, kind: 'user' },
      },
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
      samplingRatio: 1,
      indexSamplingRatio: 1,
      withReasons: true,
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
      samplingRatio: 1,
      indexSamplingRatio: 1,
      withReasons: true,
    });

    await eventProcessor.flush();
    const request = await eventSender.queue.take();

    expect(request.data).toEqual([
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
            contextKinds: ['user'],
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
            contextKinds: ['user'],
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
      samplingRatio: 1,
      indexSamplingRatio: 1,
      withReasons: true,
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
      samplingRatio: 1,
      indexSamplingRatio: 1,
      withReasons: true,
    });

    await eventProcessor.flush();

    const request = await eventSender.queue.take();

    expect(request.data).toEqual([
      {
        kind: 'index',
        creationDate: 1000,
        context: { ...user, kind: 'user' },
      },
      {
        endDate: 1000,
        features: {
          flagkey1: {
            contextKinds: ['user'],
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
            contextKinds: ['user'],
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
      samplingRatio: 1,
      indexSamplingRatio: 1,
    });

    await eventProcessor.flush();
    const request = await eventSender.queue.take();

    expect(request.data).toEqual([
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

  it('does not queue a custom event that is not sampled', async () => {
    // @ts-ignore
    shouldSample.mockImplementation((ratio) => (ratio === 2 ? false : true));
    Date.now = jest.fn(() => 1000);
    eventProcessor.sendEvent({
      kind: 'custom',
      creationDate: 1000,
      context: Context.fromLDContext(user),
      key: 'eventkey',
      data: { thing: 'stuff' },
      samplingRatio: 2,
      indexSamplingRatio: 1,
    });

    await eventProcessor.flush();
    const request = await eventSender.queue.take();

    expect(request.data).toEqual([
      {
        kind: 'index',
        creationDate: 1000,
        context: { ...user, kind: 'user' },
      },
    ]);
  });

  it('does not queue a index event that is not sampled with a custom event', async () => {
    // @ts-ignore
    shouldSample.mockImplementation((ratio) => (ratio === 2 ? true : false));
    Date.now = jest.fn(() => 1000);
    eventProcessor.sendEvent({
      kind: 'custom',
      creationDate: 1000,
      context: Context.fromLDContext(user),
      key: 'eventkey',
      data: { thing: 'stuff' },
      samplingRatio: 2,
      indexSamplingRatio: 1,
    });

    await eventProcessor.flush();
    const request = await eventSender.queue.take();

    expect(request.data).toEqual([
      {
        kind: 'custom',
        key: 'eventkey',
        data: { thing: 'stuff' },
        creationDate: 1000,
        contextKeys: {
          user: 'userKey',
        },
        samplingRatio: 2,
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
      samplingRatio: 1,
      indexSamplingRatio: 1,
    });

    await eventProcessor.flush();
    const request = await eventSender.queue.take();

    expect(request.data).toEqual([
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
      samplingRatio: 1,
      indexSamplingRatio: 1,
    });

    await eventProcessor.flush();
    const request = await eventSender.queue.take();

    expect(request.data).toEqual([
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

  it('makes no requests if there are no events to flush', async () => {
    eventProcessor.flush();
    expect(eventSender.queue.isEmpty()).toBeTruthy();
  });

  it('will not shutdown after a recoverable error', async () => {
    eventSender.defaultResult = {
      status: LDDeliveryStatus.Failed,
      error: new Error('some error'),
    };
    eventProcessor.sendEvent(new InputIdentifyEvent(Context.fromLDContext(user)));
    await expect(eventProcessor.flush()).rejects.toThrow('some error');

    eventProcessor.sendEvent(new InputIdentifyEvent(Context.fromLDContext(user)));
    await expect(eventProcessor.flush()).rejects.toThrow('some error');
  });

  it('will shutdown after a non-recoverable error', async () => {
    eventSender.defaultResult = {
      status: LDDeliveryStatus.FailedAndMustShutDown,
      error: new Error('some error'),
    };
    eventProcessor.sendEvent(new InputIdentifyEvent(Context.fromLDContext(user)));
    await expect(eventProcessor.flush()).rejects.toThrow('some error');

    eventProcessor.sendEvent(new InputIdentifyEvent(Context.fromLDContext(user)));
    await expect(eventProcessor.flush()).rejects.toThrow(/SDK key is invalid/);
  });

  it('swallows errors from failed background flush', async () => {
    // Make a new client that flushes fast.
    const newConfig = { ...eventProcessorConfig, flushInterval: 0.1 };

    eventSender.defaultResult = {
      status: LDDeliveryStatus.Failed,
      error: new Error('some error'),
    };

    eventProcessor.close();

    eventProcessor = new EventProcessor(
      newConfig,
      new ClientContext('sdk-key', basicConfiguration, platform),
      eventSender,
      contextDeduplicator,
    );
    eventProcessor.sendEvent(new InputIdentifyEvent(Context.fromLDContext(user)));

    eventSender.queue.take();
  });
});
