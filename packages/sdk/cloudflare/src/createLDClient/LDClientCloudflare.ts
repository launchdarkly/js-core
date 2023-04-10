import { KVNamespace } from '@cloudflare/workers-types';
import { EventEmitter } from 'node:events';
import { LDClientImpl, LDOptions } from '@launchdarkly/js-server-sdk-common';
import CloudflarePlatform from '../platform';
import createOptions from './createOptions';
import createCallbacks from './createCallbacks';

export default class LDClientCloudflare extends LDClientImpl {
  emitter: EventEmitter;

  // sdkKey is only used to query the KV, not to initialize with LD servers
  constructor(kvNamespace: KVNamespace, sdkKey: string, options: LDOptions = {}) {
    const emitter = new EventEmitter();

    super(
      'n/a',
      new CloudflarePlatform(),
      createOptions(kvNamespace, sdkKey, options),
      createCallbacks(emitter)
    );
    this.emitter = emitter;
  }
}
