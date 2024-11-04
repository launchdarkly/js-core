import { LDContextCommon, LDMultiKindContext } from '../../../src/api/context';
import { LDLogger } from '../../../src/api/logging/LDLogger';
import { LDContextDeduplicator, LDDeliveryStatus, LDEventType } from '../../../src/api/subsystem';
import Context from '../../../src/Context';
import { EventProcessor, InputIdentifyEvent } from '../../../src/internal';
import { EventProcessorOptions } from '../../../src/internal/events/EventProcessor';
import shouldSample from '../../../src/internal/events/sampling';
import BasicLogger from '../../../src/logging/BasicLogger';
import format from '../../../src/logging/format';
import ClientContext from '../../../src/options/ClientContext';
import ContextDeduplicator from '../../contextDeduplicator';
import { createBasicPlatform } from '../../createBasicPlatform';

let mockPlatform: ReturnType<typeof createBasicPlatform>;
let clientContext: ClientContext;
let logger: LDLogger;

beforeEach(() => {
  logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  mockPlatform = createBasicPlatform();
  clientContext = {
    basicConfiguration: {
      logger,
      sdkKey: 'testSdkKey',
      serviceEndpoints: {
        events: '',
        polling: '',
        streaming: 'https://mockstream.ld.com',
        diagnosticEventPath: '/diagnostic',
        analyticsEventPath: '/bulk',
        includeAuthorizationHeader: true,
      },
    },
    platform: mockPlatform,
  };
});

jest.mock('../../../src/internal/events/sampling', () => ({
  __esModule: true,
  default: jest.fn(() => true),
}));

const mockSendEventData = jest.fn();

jest.useFakeTimers();

jest.mock('../../../src/internal/events/EventSender', () => ({
  default: jest.fn(() => ({
    sendEventData: mockSendEventData,
  })),
}));

const user = { key: 'userKey', name: 'Red' };
const userWithFilteredName = {
  key: 'userKey',
  kind: 'user',
  name: 'Red',
  _meta: { privateAttributes: ['name'] },
};
const anonUser = { key: 'anon-user', name: 'Anon', anonymous: true };
const filteredUser = { key: 'userKey', kind: 'user', _meta: { redactedAttributes: ['name'] } };

const testIndexEvent = { context: { ...user, kind: 'user' }, creationDate: 1000, kind: 'index' };
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
    context: {
      key: 'userKey',
      name: 'Red',
      kind: 'user',
    },
  };
}

describe('given an event processor', () => {
  let contextDeduplicator: LDContextDeduplicator;
  let eventProcessor: EventProcessor;

  const eventProcessorConfig: EventProcessorOptions = {
    allAttributesPrivate: false,
    privateAttributes: [],
    eventsCapacity: 1000,
    flushInterval: 300,
    diagnosticRecordingInterval: 900,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendEventData.mockImplementation(() =>
      Promise.resolve({
        status: LDDeliveryStatus.Succeeded,
      }),
    );
    contextDeduplicator = new ContextDeduplicator();
    eventProcessor = new EventProcessor(
      eventProcessorConfig,
      clientContext,
      {},
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

    expect(mockSendEventData).toBeCalledWith(LDEventType.AnalyticsEvents, [
      {
        context: { ...user, kind: 'user' },
        creationDate: 1000,
        kind: 'identify',
      },
    ]);
  });

  it('filters user in identify event', async () => {
    Date.now = jest.fn(() => 1000);
    eventProcessor.sendEvent(new InputIdentifyEvent(Context.fromLDContext(userWithFilteredName)));

    await eventProcessor.flush();

    expect(mockSendEventData).toBeCalledWith(LDEventType.AnalyticsEvents, [
      {
        context: { ...filteredUser, kind: 'user' },
        creationDate: 1000,
        kind: 'identify',
      },
    ]);
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

    expect(mockSendEventData).toBeCalledWith(LDEventType.AnalyticsEvents, [
      {
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
        },
        creationDate: 1000,
        kind: 'identify',
      },
    ]);
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
      withReasons: true,
    });

    await eventProcessor.flush();

    expect(mockSendEventData).toBeCalledWith(LDEventType.AnalyticsEvents, [
      testIndexEvent,
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
      withReasons: true,
    });

    await eventProcessor.flush();
    expect(shouldSample).toHaveBeenCalledWith(2);

    expect(mockSendEventData).toBeCalledWith(LDEventType.AnalyticsEvents, [
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
    shouldSample.mockImplementation((ratio) => ratio !== 2);
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
      withReasons: true,
    });

    await eventProcessor.flush();
    expect(shouldSample).toHaveBeenCalledWith(2);

    expect(mockSendEventData).toBeCalledWith(LDEventType.AnalyticsEvents, [
      {
        kind: 'index',
        creationDate: 1000,
        context: { ...user, kind: 'user' },
      },
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
      withReasons: true,
    });

    await eventProcessor.flush();

    expect(mockSendEventData).toBeCalledWith(LDEventType.AnalyticsEvents, [
      testIndexEvent,
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
      withReasons: true,
    });

    await eventProcessor.flush();

    expect(mockSendEventData).toBeCalledWith(LDEventType.AnalyticsEvents, [
      testIndexEvent,
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
      withReasons: true,
    });

    await eventProcessor.flush();

    expect(mockSendEventData).toBeCalledWith(LDEventType.AnalyticsEvents, [
      testIndexEvent,
      makeFeatureEvent(1000, 11, false),
      makeFeatureEvent(1000, 11, true),
      makeSummary(1000, 1000, 1, 11),
    ]);
  });

  it('redacts all attributes from anonymous single-kind context for feature events', async () => {
    const userObj = { key: 'user-key', kind: 'user', name: 'Example user', anonymous: true };
    const context = Context.fromLDContext(userObj);

    Date.now = jest.fn(() => 1000);
    eventProcessor.sendEvent({
      kind: 'feature',
      creationDate: 1000,
      context,
      key: 'flagkey',
      version: 11,
      variation: 1,
      value: 'value',
      trackEvents: true,
      default: 'default',
      samplingRatio: 1,
      withReasons: true,
    });

    await eventProcessor.flush();

    const redactedContext = {
      kind: 'user',
      key: 'user-key',
      anonymous: true,
      _meta: {
        redactedAttributes: ['name'],
      },
    };

    const expectedIndexEvent = { ...testIndexEvent, context: userObj };
    const expectedFeatureEvent = { ...makeFeatureEvent(1000, 11, false), context: redactedContext };

    expect(mockSendEventData).toBeCalledWith(LDEventType.AnalyticsEvents, [
      expectedIndexEvent,
      expectedFeatureEvent,
      makeSummary(1000, 1000, 1, 11),
    ]);
  });

  it('redacts all attributes from anonymous multi-kind context for feature events', async () => {
    const userObj: LDContextCommon = { key: 'user-key', name: 'Example user', anonymous: true };
    const org: LDContextCommon = { key: 'org-key', name: 'Example org' };
    const multi: LDMultiKindContext = { kind: 'multi', user: userObj, org };
    const context = Context.fromLDContext(multi);

    Date.now = jest.fn(() => 1000);
    eventProcessor.sendEvent({
      kind: 'feature',
      creationDate: 1000,
      context,
      key: 'flagkey',
      version: 11,
      variation: 1,
      value: 'value',
      trackEvents: true,
      default: 'default',
      samplingRatio: 1,
      withReasons: true,
    });

    await eventProcessor.flush();

    const redactedUserContext = {
      key: 'user-key',
      anonymous: true,
      _meta: {
        redactedAttributes: ['name'],
      },
    };

    const expectedIndexEvent = { ...testIndexEvent, context: multi };
    const expectedFeatureEvent = {
      ...makeFeatureEvent(1000, 11, false),
      context: { ...multi, user: redactedUserContext },
    };
    const expectedSummaryEvent = makeSummary(1000, 1000, 1, 11);
    expectedSummaryEvent.features.flagkey.contextKinds = ['user', 'org'];

    expect(mockSendEventData).toBeCalledWith(LDEventType.AnalyticsEvents, [
      expectedIndexEvent,
      expectedFeatureEvent,
      expectedSummaryEvent,
    ]);
  });

  it('expires debug mode based on client time if client time is later than server time', async () => {
    Date.now = jest.fn(() => 2000);

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
      withReasons: true,
    });

    await eventProcessor.flush();

    expect(mockSendEventData).toBeCalledWith(LDEventType.AnalyticsEvents, [
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
      withReasons: true,
    });

    await eventProcessor.flush();

    expect(mockSendEventData).toBeCalledWith(LDEventType.AnalyticsEvents, [
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
      withReasons: true,
    });

    await eventProcessor.flush();

    expect(mockSendEventData).toBeCalledWith(LDEventType.AnalyticsEvents, [
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
    });

    await eventProcessor.flush();

    expect(mockSendEventData).toBeCalledWith(LDEventType.AnalyticsEvents, [
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
      samplingRatio: 1,
    });

    await eventProcessor.flush();

    expect(mockSendEventData).toBeCalledWith(LDEventType.AnalyticsEvents, [
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
    });

    await eventProcessor.flush();

    expect(mockSendEventData).toBeCalledWith(LDEventType.AnalyticsEvents, [
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
    await eventProcessor.flush();
    expect(mockSendEventData).not.toBeCalled();
  });

  it('will not shutdown after a recoverable error', async () => {
    mockSendEventData.mockImplementation(() =>
      Promise.resolve({
        status: LDDeliveryStatus.Failed,
        error: new Error('some error'),
      }),
    );

    eventProcessor.sendEvent(new InputIdentifyEvent(Context.fromLDContext(user)));
    await expect(eventProcessor.flush()).rejects.toThrow('some error');

    eventProcessor.sendEvent(new InputIdentifyEvent(Context.fromLDContext(user)));
    await expect(eventProcessor.flush()).rejects.toThrow('some error');
  });

  it('will shutdown after a non-recoverable error', async () => {
    mockSendEventData.mockImplementation(() =>
      Promise.resolve({
        status: LDDeliveryStatus.FailedAndMustShutDown,
        error: new Error('some error'),
      }),
    );

    eventProcessor.sendEvent(new InputIdentifyEvent(Context.fromLDContext(user)));
    await expect(eventProcessor.flush()).rejects.toThrow('some error');

    eventProcessor.sendEvent(new InputIdentifyEvent(Context.fromLDContext(user)));
    await expect(eventProcessor.flush()).rejects.toThrow(
      'Events cannot be posted because a permanent error has been encountered.',
    );
  });

  it('swallows errors from failed background flush', async () => {
    mockSendEventData.mockImplementation(() =>
      Promise.resolve({
        status: LDDeliveryStatus.Failed,
        error: new Error('some error'),
      }),
    );
    const mockConsole = jest.fn();
    const clientContextWithDebug = { ...clientContext };
    clientContextWithDebug.basicConfiguration.logger = new BasicLogger({
      level: 'debug',
      destination: mockConsole,
      formatter: format,
    });
    eventProcessor = new EventProcessor(
      eventProcessorConfig,
      clientContextWithDebug,
      {},
      contextDeduplicator,
    );

    eventProcessor.sendEvent(new InputIdentifyEvent(Context.fromLDContext(user)));
    await jest.advanceTimersByTimeAsync(eventProcessorConfig.flushInterval * 1000);

    expect(mockConsole).toHaveBeenCalledTimes(3);
    expect(mockConsole).toHaveBeenNthCalledWith(1, 'debug: [LaunchDarkly] Started EventProcessor.');
    expect(mockConsole).toHaveBeenNthCalledWith(2, 'debug: [LaunchDarkly] Flushing 1 events');
    expect(mockConsole).toHaveBeenNthCalledWith(
      3,
      'debug: [LaunchDarkly] Flush failed: Error: some error',
    );
  });
});
