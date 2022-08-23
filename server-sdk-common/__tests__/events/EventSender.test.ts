/* eslint-disable @typescript-eslint/no-unused-vars */
import { ClientContext, EventSource, EventSourceInitDict, Headers, Info, Options, PlatformData, Requests, Response, SdkData } from '@launchdarkly/js-sdk-common';
import { LDDeliveryStatus, LDEventType } from '@launchdarkly/js-sdk-common/dist/api/subsystem';
import { AsyncQueue } from 'launchdarkly-js-test-helpers';
import EventSender from '../../src/events/EventSender';
import Configuration from '../../src/options/Configuration';
import basicPlatform from '../evaluation/mocks/platform';


describe('given an event sender', () => {
  let queue: AsyncQueue<{ url: string, options?: Options }>;
  let eventSender: EventSender;
  let requestStatus = 200;
  let requestHeaders: Record<string, string> = {};

  beforeEach(() => {
    queue = new AsyncQueue();
    requestHeaders = {};

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

    const requests: Requests = {
      /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
      fetch(url: string, options?: Options): Promise<Response> {
        queue.add({ url, options });

        return new Promise<Response>((a, r) => {
          const headers: Headers = {
            get(name: string): string | null {
              return requestHeaders[name] ?? null;
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
            status: requestStatus,
            text(): Promise<string> {
              throw new Error('Function not implemented.');
            },
            json(): Promise<any> {
              throw new Error('Function not implemented.');
            },
          };
          a(res);
        });
      },

      /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
      createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource {
        throw new Error('Function not implemented.');
      },
    };

    const config = new Configuration({});
    eventSender = new EventSender(config, new ClientContext('sdk-key', config, { ...basicPlatform, requests, info }));
  });

  it('indicates a success for a success status', async () => {
    const res = await eventSender.sendEventData(LDEventType.AnalyticsEvents, { something: true });
    expect(res.status).toEqual(LDDeliveryStatus.Succeeded);
  });

  it('includes the correct headers for analytics', async () => {
    await eventSender.sendEventData(LDEventType.AnalyticsEvents, { something: true });
    const req1 = await queue.take();
    expect(req1.options?.headers).toMatchObject({
      authorization: 'sdk-key',
      'user-agent': 'NodeJSClient/2.0.2',
      'x-launchDarkly-event-schema': '4',
    });
    expect(req1.options?.headers!['x-launchdarkly-payload-id']).toBeDefined();
  });

  it('includes the payload', async () => {
    await eventSender.sendEventData(LDEventType.AnalyticsEvents, { something: true });
    await eventSender.sendEventData(LDEventType.DiagnosticEvent, { something: false });
    const req1 = await queue.take();
    const req2 = await queue.take();

    expect(req1.options?.body).toEqual(JSON.stringify({ something: true }));
    expect(req2.options?.body).toEqual(JSON.stringify({ something: false }));
  });

  it('includes the correct headers for diagnostics', async () => {
    await eventSender.sendEventData(LDEventType.DiagnosticEvent, { something: true });
    const req1 = await queue.take();
    expect(req1.options?.headers).toEqual({
      authorization: 'sdk-key',
      'user-agent': 'NodeJSClient/2.0.2',
    });
  });

  it('sends a unique payload for analytics events', async () => {
    await eventSender.sendEventData(LDEventType.AnalyticsEvents, { something: true });
    const req1 = await queue.take();
    await eventSender.sendEventData(LDEventType.AnalyticsEvents, { something: true });
    const req2 = await queue.take();
    expect(
      req1.options!.headers!['x-launchdarkly-payload-id']
    ).not.toEqual(
      req2.options!.headers!['x-launchdarkly-payload-id']
    );
  });

  it('can get server time', async () => {
    requestHeaders['date'] = new Date(1000).toISOString();
    const res = await eventSender.sendEventData(LDEventType.AnalyticsEvents, { something: true });
    expect(res.serverTime).toEqual(new Date(1000).getTime());
  });

  describe.each([400, 408, 429, 503])('given recoverable errors', (status) => {
    it(`retries - ${status}`, async () => {
      requestStatus = status;
      const res = await eventSender.sendEventData(LDEventType.AnalyticsEvents, { something: true });
      expect(res.status).toEqual(LDDeliveryStatus.Failed);
      expect(res.error).toBeDefined();

      expect(queue.length()).toEqual(2);
    });
  });

  describe.each([401, 403])('given unrecoverable errors', (status) => {
    it(`does not retry - ${status}`, async () => {
      requestStatus = status;
      const res = await eventSender.sendEventData(LDEventType.AnalyticsEvents, { something: true });
      expect(res.status).toEqual(LDDeliveryStatus.FailedAndMustShutDown);
      expect(queue.length()).toEqual(1);
    });
  });
});