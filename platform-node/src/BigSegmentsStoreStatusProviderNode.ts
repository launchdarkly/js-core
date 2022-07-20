import { BigSegmentStoreStatusProviderImpl, interfaces } from '@launchdarkly/js-server-sdk-common';
import { BigSegmentStoreStatus } from '@launchdarkly/js-server-sdk-common/dist/api/interfaces';
import { EventEmitter } from 'events';
import { Emits } from './Emits';

class BigSegmentStoreStatusProviderNode implements interfaces.BigSegmentStoreStatusProvider {
  emitter: EventEmitter = new EventEmitter();

  constructor(
    private readonly provider: BigSegmentStoreStatusProviderImpl,
  ) {
    this.provider.setListener((status: BigSegmentStoreStatus) => {
      this.dispatch('change', status);
    });
  }

  getStatus(): interfaces.BigSegmentStoreStatus | undefined {
    return this.provider.getStatus();
  }

  requireStatus(): Promise<interfaces.BigSegmentStoreStatus> {
    return this.provider.requireStatus();
  }

  dispatch(eventType: string, status: interfaces.BigSegmentStoreStatus) {
    this.emitter.emit(eventType, status);
  }
}

export default Emits(BigSegmentStoreStatusProviderNode);
