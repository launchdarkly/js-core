import { EventEmitter } from 'node:events';
  LDClientImpl,
import { Info, LDClientImpl, LDFeatureStore } from '@launchdarkly/js-server-sdk-common';
import createOptions from './createOptions';
import createCallbacks from './createCallbacks';
import EdgePlatform from '../platform';

/**
 * The LaunchDarkly SDK edge client object.
 *
 * Create this object with {@link init}. Applications should configure the client at startup time
 * and continue to use it throughout the lifetime of the application, rather than creating instances
 * on the fly.
 *
 */
export class LDClient extends LDClientImpl {
  emitter: EventEmitter;

  // sdkKey is only used to query featureStore, not to initialize with LD servers
  constructor(sdkKey: string, featureStore: LDFeatureStore, platformInfo: Info) {
    const em = new EventEmitter();
    const platform = new EdgePlatform(platformInfo);
    super('n/a', platform, createOptions(sdkKey, featureStore), createCallbacks(em));
    this.emitter = em;
  }
}

export default LDClient;
