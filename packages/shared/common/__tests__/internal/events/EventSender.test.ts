import { Info, PlatformData, SdkData } from '../../../src/api';
import { LDDeliveryStatus, LDEventSenderResult, LDEventType } from '../../../src/api/subsystem';
import EventSender from '../../../src/internal/events/EventSender';
import { ApplicationTags, ClientContext } from '../../../src/options';
import { createBasicPlatform } from '../../createBasicPlatform';

let mockPlatform: ReturnType<typeof createBasicPlatform>;

function runWithTimers<T>(fn: () => Promise<T>) {
  const promise = fn();
  return jest.runAllTimersAsync().then(() => promise);
}

beforeEach(() => {
  mockPlatform = createBasicPlatform();
});

const basicConfig = {
  tags: new ApplicationTags({ application: { id: 'testApplication1', version: '1.0.0' } }),
  serviceEndpoints: {
    events: 'https://events.fake.com',
    streaming: '',
    polling: '',
    analyticsEventPath: '/bulk',
    diagnosticEventPath: '/diagnostic',
    includeAuthorizationHeader: true,
  },
};
const testEventData1 = { eventId: 'test-event-data-1' };
const testEventData2 = { eventId: 'test-event-data-2' };
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
      userAgentBase: 'TestUserAgent',
      wrapperName: 'Rapper',
      wrapperVersion: '1.2.3',
    };
  },
};

const analyticsHeaders = (uuid: number) => ({
  authorization: 'sdk-key',
  'content-type': 'application/json',
  'user-agent': 'TestUserAgent/2.0.2',
  'x-launchDarkly-event-schema': '4',
  'x-launchdarkly-payload-id': `${uuid}`,
  'x-launchdarkly-tags': 'application-id/testApplication1 application-version/1.0.0',
  'x-launchdarkly-wrapper': 'Rapper/1.2.3',
});

const diagnosticHeaders = {
  authorization: 'sdk-key',
  'content-type': 'application/json',
  'user-agent': 'TestUserAgent/2.0.2',
  'x-launchDarkly-event-schema': undefined,
  'x-launchdarkly-payload-id': undefined,
  'x-launchdarkly-tags': 'application-id/testApplication1 application-version/1.0.0',
  'x-launchdarkly-wrapper': 'Rapper/1.2.3',
};

describe('given an event sender', () => {
  let eventSender: EventSender;
  let mockFetch: jest.Mock;
  let mockHeadersGet: jest.Mock;
  let mockRandomUuid: jest.Mock<string>;
  let uuid: number;
  const dateNowString = '2023-08-10';
  let eventSenderResult: LDEventSenderResult;

  const setupMockFetch = (responseStatusCode: number) => {
    mockFetch = jest
      .fn()
      .mockResolvedValue({ headers: { get: mockHeadersGet }, status: responseStatusCode });
    mockPlatform.requests.fetch = mockFetch;
  };

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(dateNowString));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockHeadersGet = jest.fn((key) => (key === 'date' ? new Date() : undefined));
    uuid = 0;
    mockRandomUuid = jest.fn(() => {
      uuid += 1;
      return `${uuid}`;
    });
    setupMockFetch(200);
    mockPlatform.crypto.randomUUID = mockRandomUuid;

    eventSender = new EventSender(
      new ClientContext('sdk-key', basicConfig, { ...mockPlatform, info }),
      {
        authorization: 'sdk-key',
        'user-agent': 'TestUserAgent/2.0.2',
        'x-launchdarkly-tags': 'application-id/testApplication1 application-version/1.0.0',
        'x-launchdarkly-wrapper': 'Rapper/1.2.3',
      },
    );

    eventSenderResult = await runWithTimers(() =>
      eventSender.sendEventData(LDEventType.AnalyticsEvents, testEventData1),
    );
  });

  it('includes the correct headers for analytics', async () => {
    const { status, serverTime, error } = eventSenderResult;

    expect(status).toEqual(LDDeliveryStatus.Succeeded);
    expect(serverTime).toEqual(Date.now());
    expect(error).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(`${basicConfig.serviceEndpoints.events}/bulk`, {
      body: JSON.stringify(testEventData1),
      headers: analyticsHeaders(uuid),
      method: 'POST',
      keepalive: true,
    });
  });

  it('includes the payload', async () => {
    const { status: status1 } = eventSenderResult;
    const { status: status2 } = await runWithTimers(() =>
      eventSender.sendEventData(LDEventType.DiagnosticEvent, testEventData2),
    );

    expect(status1).toEqual(LDDeliveryStatus.Succeeded);
    expect(status2).toEqual(LDDeliveryStatus.Succeeded);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(1, `${basicConfig.serviceEndpoints.events}/bulk`, {
      body: JSON.stringify(testEventData1),
      headers: analyticsHeaders(uuid),
      method: 'POST',
      keepalive: true,
    });
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      `${basicConfig.serviceEndpoints.events}/diagnostic`,
      {
        body: JSON.stringify(testEventData2),
        headers: diagnosticHeaders,
        method: 'POST',
        keepalive: true,
      },
    );
  });

  it('sends a unique payload for analytics events', async () => {
    // send the same request again to assert unique uuids
    await runWithTimers(() =>
      eventSender.sendEventData(LDEventType.AnalyticsEvents, testEventData1),
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      `${basicConfig.serviceEndpoints.events}/bulk`,
      expect.objectContaining({
        headers: analyticsHeaders(1),
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      `${basicConfig.serviceEndpoints.events}/bulk`,
      expect.objectContaining({
        headers: analyticsHeaders(2),
      }),
    );
  });

  describe.each([400, 408, 429, 503])('given recoverable errors', (responseStatusCode) => {
    beforeEach(async () => {
      setupMockFetch(responseStatusCode);
      eventSenderResult = await runWithTimers(() =>
        eventSender.sendEventData(LDEventType.AnalyticsEvents, testEventData1),
      );
    });

    it(`retries - ${responseStatusCode}`, async () => {
      const { status, error } = eventSenderResult;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(status).toEqual(LDDeliveryStatus.Failed);
      expect(error.name).toEqual('LaunchDarklyUnexpectedResponseError');
      expect(error.message).toEqual(
        `Received error ${responseStatusCode} for event posting - giving up permanently`,
      );
    });
  });

  it('given a result for too large of a payload', async () => {
    setupMockFetch(413);
    eventSenderResult = await runWithTimers(() =>
      eventSender.sendEventData(LDEventType.AnalyticsEvents, testEventData1),
    );

    const errorMessage = `Received error 413 for event posting - giving up permanently`;

    const { status, error } = eventSenderResult;

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(status).toEqual(LDDeliveryStatus.Failed);
    expect(error.name).toEqual('LaunchDarklyUnexpectedResponseError');
    expect(error.message).toEqual(errorMessage);
  });

  describe.each([401, 403])('given unrecoverable errors', (responseStatusCode) => {
    beforeEach(async () => {
      setupMockFetch(responseStatusCode);
      eventSenderResult = await runWithTimers(() =>
        eventSender.sendEventData(LDEventType.AnalyticsEvents, testEventData1),
      );
    });

    it(`does not retry - ${responseStatusCode}`, async () => {
      const errorMessage = `Received error ${
        responseStatusCode === 401 ? '401 (invalid SDK key)' : responseStatusCode
      } for event posting - giving up permanently`;

      const { status, error } = eventSenderResult;

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(status).toEqual(LDDeliveryStatus.FailedAndMustShutDown);
      expect(error.name).toEqual('LaunchDarklyUnexpectedResponseError');
      expect(error.message).toEqual(errorMessage);
    });
  });
});
