import { EventEmitter } from 'node:events';

import { Info, LDClientImpl, LDOptions } from '@launchdarkly/js-server-sdk-common';

import EdgePlatform from '../platform';
import createCallbacks from './createCallbacks';
import createOptions from './createOptions';

/**
 * The LaunchDarkly SDK edge client object.
 */
export class LDClient extends LDClientImpl {
  emitter: EventEmitter;

  // sdkKey is only used to query featureStore, not to initialize with LD servers
  constructor(sdkKey: string, platformInfo: Info, options: LDOptions) {
    const em = new EventEmitter();
    const platform = new EdgePlatform(platformInfo);
    super('n/a', platform, createOptions(options), createCallbacks(em));
    this.emitter = em;
  }
}

export default LDClient;
