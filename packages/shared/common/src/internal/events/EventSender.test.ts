/* eslint-disable @typescript-eslint/no-unused-vars */
import { Info, PlatformData, SdkData } from '../../api';
import { LDDeliveryStatus, LDEventType } from '../../api/subsystem';
import { basicPlatform } from '../../mocks';
import { ApplicationTags, ClientContext } from '../../options';
import EventSender from './EventSender';

const basicConfig = {
  tags: new ApplicationTags({ application: { id: 'testApplication1', version: '1.0.0' } }),
  serviceEndpoints: { events: 'https://events.fake.com', streaming: '', polling: '' },
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
  let requestStatus: number;
  let mockFetch: jest.Mock;
  let mockHeadersGet: jest.Mock;
  let mockRandomUuid: jest.Mock<string>;
  let uuid: number;
  const dateNowString = '2023-08-10';

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(dateNowString));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    requestStatus = 200;
    mockHeadersGet = jest.fn((key) => (key === 'date' ? new Date() : undefined));
    mockFetch = jest
      .fn()
      .mockResolvedValue({ headers: { get: mockHeadersGet }, status: requestStatus });
    uuid = 0;
    mockRandomUuid = jest.fn(() => {
      uuid += 1;
      return `${uuid}`;
    });

    basicPlatform.requests.fetch = mockFetch;
    basicPlatform.crypto.randomUUID = mockRandomUuid;
    eventSender = new EventSender(
      new ClientContext('sdk-key', basicConfig, { ...basicPlatform, info }),
    );
  });

  it('includes the correct headers for analytics', async () => {
    const { status, serverTime, error } = await eventSender.sendEventData(
      LDEventType.AnalyticsEvents,
      testEventData1,
    );

    expect(status).toEqual(LDDeliveryStatus.Succeeded);
    expect(serverTime).toEqual(Date.now());
    expect(error).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(`${basicConfig.serviceEndpoints.events}/bulk`, {
      body: JSON.stringify(testEventData1),
      headers: analyticsHeaders(uuid),
      method: 'POST',
    });
  });

  it('includes the payload', async () => {
    const { status: status1 } = await eventSender.sendEventData(
      LDEventType.AnalyticsEvents,
      testEventData1,
    );
    const { status: status2 } = await eventSender.sendEventData(
      LDEventType.DiagnosticEvent,
      testEventData2,
    );

    expect(status1).toEqual(LDDeliveryStatus.Succeeded);
    expect(status2).toEqual(LDDeliveryStatus.Succeeded);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(1, `${basicConfig.serviceEndpoints.events}/bulk`, {
      body: JSON.stringify(testEventData1),
      headers: analyticsHeaders(uuid),
      method: 'POST',
    });
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      `${basicConfig.serviceEndpoints.events}/diagnostic`,
      {
        body: JSON.stringify(testEventData2),
        headers: diagnosticHeaders,
        method: 'POST',
      },
    );
  });

  it('sends a unique payload for analytics events', async () => {
    await eventSender.sendEventData(LDEventType.AnalyticsEvents, testEventData1);
    await eventSender.sendEventData(LDEventType.AnalyticsEvents, testEventData1);

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

  // describe.each([400, 408, 429, 503])('given recoverable errors', (status) => {
  //   it(`retries - ${status}`, async () => {
  //     requestStatus = status;
  //     const res = await eventSender.sendEventData(LDEventType.AnalyticsEvents, { something: true });
  //     expect(res.status).toEqual(LDDeliveryStatus.Failed);
  //     expect(res.error).toBeDefined();
  //
  //     expect(queue.length()).toEqual(2);
  //   });
  // });
  //
  // describe.each([401, 403])('given unrecoverable errors', (status) => {
  //   it(`does not retry - ${status}`, async () => {
  //     requestStatus = status;
  //     const res = await eventSender.sendEventData(LDEventType.AnalyticsEvents, { something: true });
  //     expect(res.status).toEqual(LDDeliveryStatus.FailedAndMustShutDown);
  //     expect(queue.length()).toEqual(1);
  //   });
  // });
});
