import { EdgeConfigClient } from '@vercel/edge-config';
import { EventEmitter } from 'node:events';
import { LDClientImpl, LDOptions } from '@launchdarkly/js-server-sdk-common';
import VercelPlatform from '../platform';
import createOptions from './createOptions';
import createCallbacks from './createCallbacks';

export default class LDClientVercel extends LDClientImpl {
  emitter: EventEmitter;

  // sdkKey is only used to query the Edge Config, not to initialize with LD servers
  constructor(kvNamespace: EdgeConfigClient, sdkKey: string, options: LDOptions = {}) {
    const emitter = new EventEmitter();

    super(
      'n/a',
      new VercelPlatform(),
      createOptions(kvNamespace, sdkKey, options),
      createCallbacks(emitter)
    );
    this.emitter = emitter;
  }
}
