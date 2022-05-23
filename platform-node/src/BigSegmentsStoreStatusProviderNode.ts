import { BigSegmentStoreStatusProviderImpl } from '@launchdarkly/js-server-sdk-common';
import EventEmitter from 'events';
import { Emits } from './Emits';

class BigSegmentStoreStatusProviderNode extends BigSegmentStoreStatusProviderImpl {
  emitter: EventEmitter = new EventEmitter();
}

export default Emits(BigSegmentStoreStatusProviderNode);
