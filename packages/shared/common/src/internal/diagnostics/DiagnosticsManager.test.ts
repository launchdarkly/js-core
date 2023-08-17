import { basicPlatform } from '../mocks';
import DiagnosticsManager from './DiagnosticsManager';

describe('given a diagnostics manager', () => {
  const dateNowString = '2023-08-10';
  let manager: DiagnosticsManager;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(dateNowString));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    manager = new DiagnosticsManager('my-sdk-key', {}, basicPlatform);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('uses the last 6 characters of the SDK key in the diagnostic id', () => {
    const { id } = manager.createInitEvent();
    expect(id.sdkKeySuffix).toEqual('dk-key');
  });

  it('creates random UUID', () => {
    const { id } = manager.createInitEvent();

    const manager2 = new DiagnosticsManager('my-sdk-key', {}, basicPlatform);
    const { id: id2 } = manager2.createInitEvent();
    expect(id.diagnosticId).toBeTruthy();
    expect(id2.diagnosticId).toBeTruthy();
    expect(id.diagnosticId).not.toEqual(id2.diagnosticId);
  });

  it('puts the start time into the init event', () => {
    const { creationDate } = manager.createInitEvent();
    expect(creationDate).toEqual(Date.now());
  });

  it('puts SDK data into the init event', () => {
    const { sdk } = manager.createInitEvent();
    expect(sdk).toMatchObject(basicPlatform.info.sdkData());
  });

  it('puts platform data into the init event', () => {
    const { platform } = manager.createInitEvent();
    expect(platform).toEqual({
      name: 'The SDK Name',
      osName: 'An OS',
      osVersion: '1.0.1',
      osArch: 'An Arch',
      nodeVersion: '42',
    });
  });

  // TODO: fix this using fake timers
  it.only('creates periodic event from stats, then resets', () => {
    manager.recordStreamInit(7778, true, 1000);
    manager.recordStreamInit(7779, false, 550);

    jest.spyOn(Date, 'now').mockImplementation(() => 8888);

    const event1 = manager.createStatsEventAndReset(4, 5, 6);

    expect(event1).toMatchObject({
      kind: 'diagnostic',
      dataSinceDate: 7777,
      droppedEvents: 4,
      deduplicatedUsers: 5,
      eventsInLastBatch: 6,
      streamInits: [
        {
          timestamp: 7778,
          failed: true,
          durationMillis: 1000,
        },
        {
          timestamp: 7779,
          failed: false,
          durationMillis: 550,
        },
      ],
    });

    expect(event1.creationDate).toEqual(8888);

    jest.spyOn(Date, 'now').mockImplementation(() => 9999);
    const event2 = manager.createStatsEventAndReset(1, 2, 3);

    expect(event2).toMatchObject({
      kind: 'diagnostic',
      dataSinceDate: event1.creationDate,
      droppedEvents: 1,
      deduplicatedUsers: 2,
      eventsInLastBatch: 3,
      streamInits: [],
    });

    expect(event2.creationDate).toEqual(9999);
  });
});

const fakeStore = {
  getDescription: () => 'WeirdStore',
};

describe.each([
  [
    {},
    {
      allAttributesPrivate: false,
      connectTimeoutMillis: 5000,
      customBaseURI: false,
      customEventsURI: false,
      customStreamURI: false,
      dataStoreType: 'memory',
      diagnosticRecordingIntervalMillis: 900000,
      eventsCapacity: 10000,
      eventsFlushIntervalMillis: 5000,
      offline: false,
      pollingIntervalMillis: 30000,
      reconnectTimeMillis: 1000,
      socketTimeoutMillis: 5000,
      streamingDisabled: false,
      contextKeysCapacity: 1000,
      contextKeysFlushIntervalMillis: 300000,
      usingProxy: false,
      usingProxyAuthenticator: false,
      usingRelayDaemon: false,
    },
  ],
  [
    { baseUri: 'http://other' },
    {
      customBaseURI: true,
      customEventsURI: false,
      customStreamURI: false,
    },
  ],
  [
    { eventsUri: 'http://other' },
    {
      customBaseURI: false,
      customEventsURI: true,
      customStreamURI: false,
    },
  ],
  [
    { streamUri: 'http://other' },
    {
      customBaseURI: false,
      customEventsURI: false,
      customStreamURI: true,
    },
  ],
  [{ allAttributesPrivate: true }, { allAttributesPrivate: true }],
  [{ timeout: 6 }, { connectTimeoutMillis: 6000, socketTimeoutMillis: 6000 }],
  [{ diagnosticRecordingInterval: 999 }, { diagnosticRecordingIntervalMillis: 999000 }],
  [{ capacity: 999 }, { eventsCapacity: 999 }],
  [{ flushInterval: 33 }, { eventsFlushIntervalMillis: 33000 }],
  [{ stream: false }, { streamingDisabled: true }],
  [{ streamInitialReconnectDelay: 33 }, { reconnectTimeMillis: 33000 }],
  [{ contextKeysCapacity: 111 }, { contextKeysCapacity: 111 }],
  [{ contextKeysFlushInterval: 33 }, { contextKeysFlushIntervalMillis: 33000 }],
  [{ useLdd: true }, { usingRelayDaemon: true }],
  [{ featureStore: fakeStore }, { dataStoreType: 'WeirdStore' }],
])('given diagnostics managers with different configurations', (configIn, configOut) => {
  let manager: DiagnosticsManager;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockImplementation(() => 7777);
    manager = new DiagnosticsManager('my-sdk-key', configIn, basicPlatform);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('translates the configuration correctly', () => {
    const event = manager.createInitEvent();
    expect(event.configuration).toMatchObject(configOut);
  });
});

describe.each([true, false])('Given proxy and proxy auth=%p', (auth) => {
  let manager: DiagnosticsManager;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockImplementation(() => 7777);
    jest.spyOn(basicPlatform.requests, 'usingProxy').mockImplementation(() => true);
    jest.spyOn(basicPlatform.requests, 'usingProxyAuth').mockImplementation(() => auth);
    manager = new DiagnosticsManager('my-sdk-key', {}, basicPlatform);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('it gets the proxy configuration from the platform', () => {
    const event = manager.createInitEvent();
    expect(event.configuration).toMatchObject({
      usingProxy: true,
      usingProxyAuthenticator: auth,
    });
  });
});
