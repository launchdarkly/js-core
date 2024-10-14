import { Crypto, Requests } from '../../api';
import {
  LDDeliveryStatus,
  LDEventSender,
  LDEventSenderResult,
  LDEventType,
} from '../../api/subsystem';
import {
  isHttpLocallyRecoverable,
  isHttpRecoverable,
  LDUnexpectedResponseError,
} from '../../errors';
import { ClientContext, getEventsUri } from '../../options';
import { httpErrorMessage, LDHeaders, sleep } from '../../utils';

export default class EventSender implements LDEventSender {
  private _crypto: Crypto;
  private _defaultHeaders: {
    [key: string]: string;
  };
  private _diagnosticEventsUri: string;
  private _eventsUri: string;
  private _requests: Requests;

  constructor(clientContext: ClientContext, baseHeaders: LDHeaders) {
    const { basicConfiguration, platform } = clientContext;
    const {
      serviceEndpoints: { analyticsEventPath, diagnosticEventPath },
    } = basicConfiguration;
    const { crypto, requests } = platform;

    this._defaultHeaders = { ...baseHeaders };
    this._eventsUri = getEventsUri(basicConfiguration.serviceEndpoints, analyticsEventPath, []);
    this._diagnosticEventsUri = getEventsUri(
      basicConfiguration.serviceEndpoints,
      diagnosticEventPath,
      [],
    );
    this._requests = requests;
    this._crypto = crypto;
  }

  private async _tryPostingEvents(
    events: any,
    uri: string,
    payloadId: string | undefined,
    canRetry: boolean,
  ): Promise<LDEventSenderResult> {
    const tryRes: LDEventSenderResult = {
      status: LDDeliveryStatus.Succeeded,
    };

    const headers: Record<string, string> = {
      ...this._defaultHeaders,
      'content-type': 'application/json',
    };

    if (payloadId) {
      headers['x-launchdarkly-payload-id'] = payloadId;
      headers['x-launchDarkly-event-schema'] = '4';
    }
    let error;
    try {
      const { status, headers: resHeaders } = await this._requests.fetch(uri, {
        headers,
        body: JSON.stringify(events),
        method: 'POST',
        // When sending events from browser environments the request should be completed even
        // if the user is navigating away from the page.
        keepalive: true,
      });

      const serverDate = Date.parse(resHeaders.get('date') || '');
      if (serverDate) {
        tryRes.serverTime = serverDate;
      }

      if (status <= 204) {
        return tryRes;
      }

      error = new LDUnexpectedResponseError(
        httpErrorMessage({ status, message: 'some events were dropped' }, 'event posting'),
      );

      if (!isHttpRecoverable(status)) {
        // If the HTTP request isn't recoverable. Meaning if we made the same request it
        // would not recover, then we check if a different request could recover.
        // If a different request could not recover, then we shutdown. If a different request could
        // recover, then we just don't retry this specific request.
        if (!isHttpLocallyRecoverable(status)) {
          tryRes.status = LDDeliveryStatus.FailedAndMustShutDown;
        } else {
          tryRes.status = LDDeliveryStatus.Failed;
        }
        tryRes.error = error;
        return tryRes;
      }
    } catch (err) {
      error = err;
    }

    // recoverable but not retrying
    if (error && !canRetry) {
      tryRes.status = LDDeliveryStatus.Failed;
      tryRes.error = error;
      return tryRes;
    }

    // wait 1 second before retrying
    await sleep();

    return this._tryPostingEvents(events, this._eventsUri, payloadId, false);
  }

  async sendEventData(type: LDEventType, data: any): Promise<LDEventSenderResult> {
    const payloadId = type === LDEventType.AnalyticsEvents ? this._crypto.randomUUID() : undefined;
    const uri = type === LDEventType.AnalyticsEvents ? this._eventsUri : this._diagnosticEventsUri;

    return this._tryPostingEvents(data, uri, payloadId, true);
  }
}
