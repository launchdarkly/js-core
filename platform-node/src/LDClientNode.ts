import {
  LDClientImpl, LDOptions,
} from '@launchdarkly/js-server-sdk-common';

import EventEmitter from 'events';
import NodePlatform from './platform/NodePlatform';
import { Emits } from './Emits';
import BigSegmentStoreStatusProviderNode from './BigSegmentsStoreStatusProviderNode';
import { BigSegmentStoreStatusProvider } from './api';

class LDClientNode extends LDClientImpl {
  emitter: EventEmitter = new EventEmitter();

  bigSegmentStoreStatusProvider: BigSegmentStoreStatusProvider;

  constructor(private sdkKey: string, options: LDOptions) {
    super(new NodePlatform(options));
    this.bigSegmentStoreStatusProvider = new BigSegmentStoreStatusProviderNode(
      this.bigSegmentStatusProviderInternal,
    ) as BigSegmentStoreStatusProvider;
  }
}

export default Emits(LDClientNode);
