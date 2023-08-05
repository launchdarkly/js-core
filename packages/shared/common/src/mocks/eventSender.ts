import { AsyncQueue } from 'launchdarkly-js-test-helpers';

import {
  LDDeliveryStatus,
  LDEventSender,
  LDEventSenderResult,
  LDEventType,
} from '../api/subsystem/index';

export default class EventSender implements LDEventSender {
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
