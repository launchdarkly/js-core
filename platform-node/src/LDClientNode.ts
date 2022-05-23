/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
// eslint-disable-next-line max-classes-per-file
import {
  LDClientImpl, LDOptions,
} from '@launchdarkly/js-server-sdk-common';

import EventEmitter from 'events';
import NodePlatform from './platform/NodePlatform';
import { Emits } from './Emits';
import BigSegmentStoreStatusProviderNode from './BigSegmentsStoreStatusProviderNode';

class LDClientNode extends LDClientImpl {
  emitter: EventEmitter = new EventEmitter();

  override bigSegmentStoreStatusProvider:
  InstanceType<typeof BigSegmentStoreStatusProviderNode>;

  constructor(options: LDOptions) {
    super(new NodePlatform(options));
    this.bigSegmentStoreStatusProvider = new BigSegmentStoreStatusProviderNode();
  }
}

export default Emits(LDClientNode);
