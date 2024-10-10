import { EventEmitter } from 'events';

import { BigSegmentStoreStatusProviderImpl, interfaces } from '@launchdarkly/js-server-sdk-common';

import { Emits } from './Emits';

/**
 * @ignore
 */
class BigSegmentStoreStatusProviderNode implements interfaces.BigSegmentStoreStatusProvider {
  emitter: EventEmitter = new EventEmitter();

  constructor(private readonly _provider: BigSegmentStoreStatusProviderImpl) {
    this._provider.setListener((status: interfaces.BigSegmentStoreStatus) => {
      this.dispatch('change', status);
    });
  }

  getStatus(): interfaces.BigSegmentStoreStatus | undefined {
    return this._provider.getStatus();
  }

  requireStatus(): Promise<interfaces.BigSegmentStoreStatus> {
    return this._provider.requireStatus();
  }

  dispatch(eventType: string, status: interfaces.BigSegmentStoreStatus) {
    this.emitter.emit(eventType, status);
  }

  on(event: string | symbol, listener: (...args: any[]) => void): this {
    this.emitter.on(event, listener);
    return this;
  }
}

export default Emits(BigSegmentStoreStatusProviderNode);
