import { Crypto, Requests } from '../../api';
import {
  LDDeliveryStatus,
  LDEventSender,
  LDEventSenderResult,
  LDEventType,
} from '../../api/subsystem';
import { isHttpRecoverable, LDUnexpectedResponseError } from '../../errors';
import { ClientContext } from '../../options';
import { defaultHeaders, httpErrorMessage } from '../../utils';

export default class EventSender implements LDEventSender {
  private crypto: Crypto;
  private defaultHeaders: {
    [key: string]: string;
  };
  private diagnosticEventsUri: string;
  private eventsUri: string;
  private requests: Requests;

  constructor(clientContext: ClientContext) {
    const { basicConfiguration, platform } = clientContext;
    const { sdkKey, serviceEndpoints, tags } = basicConfiguration;
    const { crypto, info, requests } = platform;

    this.defaultHeaders = defaultHeaders(sdkKey, info, tags);
    this.eventsUri = `${serviceEndpoints.events}/bulk`;
    this.diagnosticEventsUri = `${serviceEndpoints.events}/diagnostic`;
    this.requests = requests;
    this.crypto = crypto;
  }

  private async tryPostingEvents(
    events: any,
    uri: string,
    payloadId: string | undefined,
    canRetry: boolean,
  ): Promise<LDEventSenderResult> {
    const tryRes: LDEventSenderResult = {
      status: LDDeliveryStatus.Succeeded,
    };

    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      'content-type': 'application/json',
    };

    if (payloadId) {
      headers['x-launchdarkly-payload-id'] = payloadId;
      headers['x-launchDarkly-event-schema'] = '4';
    }
    let error;
    try {
      const res = await this.requests.fetch(uri, {
        headers,
        body: JSON.stringify(events),
        method: 'POST',
      });

      const serverDate = Date.parse(res.headers.get('date') || '');
      if (serverDate) {
        tryRes.serverTime = serverDate;
      }

      if (res.status <= 204) {
        return tryRes;
      }

      error = new LDUnexpectedResponseError(
        httpErrorMessage(
          { status: res.status, message: 'some events were dropped' },
          'event posting',
        ),
      );

      if (!isHttpRecoverable(res.status)) {
        tryRes.status = LDDeliveryStatus.FailedAndMustShutDown;
        tryRes.error = error;
        return tryRes;
      }
    } catch (err) {
      error = err;
    }

    if (error && !canRetry) {
      tryRes.status = LDDeliveryStatus.Failed;
      tryRes.error = error;
      return tryRes;
    }

    await new Promise((r) => {
      setTimeout(r, 1000);
    });
    return this.tryPostingEvents(events, this.eventsUri, payloadId, false);
  }

  async sendEventData(type: LDEventType, data: any): Promise<LDEventSenderResult> {
    const payloadId = type === LDEventType.AnalyticsEvents ? this.crypto.randomUUID() : undefined;
    const uri = type === LDEventType.AnalyticsEvents ? this.eventsUri : this.diagnosticEventsUri;

    return this.tryPostingEvents(data, uri, payloadId, true);
  }
}
