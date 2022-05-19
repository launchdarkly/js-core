import { LDClientImpl } from '@launchdarkly/js-server-sdk-common';
import { BigSegmentStoreStatus } from '@launchdarkly/js-server-sdk-common/dist/api/interfaces';
import EventEmitter from 'events';
import { BigSegmentStoreStatusProvider } from './api/interfaces/BigSegmentStoreStatusProvider';

export default class BigSegmentStoreStatusProviderNode
  extends EventEmitter implements BigSegmentStoreStatusProvider {
  clientBase: LDClientImpl;

  constructor(clientBase: LDClientImpl) {
    super();
    this.clientBase = clientBase;

    clientBase.bigSegmentStoreStatusProvider.setStatusHandler((status) => {
      this.emit('change', status);
    });
  }

  getStatus(): BigSegmentStoreStatus | undefined {
    return this.clientBase.bigSegmentStoreStatusProvider.getStatus();
  }

  requireStatus(): Promise<BigSegmentStoreStatus> {
    return this.clientBase.bigSegmentStoreStatusProvider.requireStatus();
  }
}
