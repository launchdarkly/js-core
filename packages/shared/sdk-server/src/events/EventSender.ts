import {
  ApplicationTags,
  ClientContext,
  Crypto,
  Requests,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import defaultHeaders from '../data_sources/defaultHeaders';
import httpErrorMessage from '../data_sources/httpErrorMessage';
import { isHttpRecoverable, LDUnexpectedResponseError } from '../errors';

export interface EventSenderOptions {
  tags: ApplicationTags;
}

export default class EventSender implements subsystem.LDEventSender {
  private defaultHeaders: {
    [key: string]: string;
  };

  private eventsUri: string;

  private diagnosticEventsUri: string;

  private requests: Requests;

  private crypto: Crypto;

  constructor(config: EventSenderOptions, clientContext: ClientContext) {
    const {
      basicConfiguration: {
        sdkKey,
        serviceEndpoints: { events, analyticsEventPath, diagnosticEventPath },
      },
      platform: { info, requests, crypto },
    } = clientContext;

    this.defaultHeaders = {
      ...defaultHeaders(sdkKey, config, info),
    };

    this.eventsUri = `${events}${analyticsEventPath}`;
    this.diagnosticEventsUri = `${events}${diagnosticEventPath}`;
    this.requests = requests;
    this.crypto = crypto;
  }

  private async tryPostingEvents(
    events: any,
    uri: string,
    payloadId: string | undefined,
    canRetry: boolean,
  ): Promise<subsystem.LDEventSenderResult> {
    const tryRes: subsystem.LDEventSenderResult = {
      status: subsystem.LDDeliveryStatus.Succeeded,
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
        tryRes.status = subsystem.LDDeliveryStatus.FailedAndMustShutDown;
        tryRes.error = error;
        return tryRes;
      }
    } catch (err) {
      error = err;
    }

    if (error && !canRetry) {
      tryRes.status = subsystem.LDDeliveryStatus.Failed;
      tryRes.error = error;
      return tryRes;
    }

    await new Promise((r) => {
      setTimeout(r, 1000);
    });
    return this.tryPostingEvents(events, this.eventsUri, payloadId, false);
  }

  async sendEventData(
    type: subsystem.LDEventType,
    data: any,
  ): Promise<subsystem.LDEventSenderResult> {
    const payloadId =
      type === subsystem.LDEventType.AnalyticsEvents ? this.crypto.randomUUID() : undefined;
    const uri =
      type === subsystem.LDEventType.AnalyticsEvents ? this.eventsUri : this.diagnosticEventsUri;

    return this.tryPostingEvents(data, uri, payloadId, true);
  }
}
