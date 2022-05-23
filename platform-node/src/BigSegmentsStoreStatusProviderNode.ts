import { BigSegmentStoreStatusProviderImpl, interfaces } from '@launchdarkly/js-server-sdk-common';
import EventEmitter from 'events';
import { Emits } from './Emits';

class BigSegmentStoreStatusProviderNode extends BigSegmentStoreStatusProviderImpl {
  emitter: EventEmitter = new EventEmitter();

  override dispatch(eventType: string, status: interfaces.BigSegmentStoreStatus) {
    this.emitter.emit(eventType, status);
  }
}

export default Emits(BigSegmentStoreStatusProviderNode);
