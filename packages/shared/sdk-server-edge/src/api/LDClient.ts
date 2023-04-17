import { EventEmitter } from 'node:events';
import {
  Info,
  LDClient as LDClientCommon,
  LDClientImpl,
  LDFeatureStore,
} from '@launchdarkly/js-server-sdk-common';
import createOptions from './createOptions';
import createCallbacks from './createCallbacks';
import EdgeFunctionPlatform from '../platform';

/**
 * The EdgeFunction LaunchDarkly SDK client object.
 *
 * Create this object with {@link init}. Applications should configure the client at startup time
 * and continue to use it throughout the lifetime of the application, rather than creating instances
 * on the fly.
 *
 * The EdgeFunction client only supports these functions:
 *  - allFlagsState
 *  - variation
 *  - variationDetail
 *  - waitForInitialization
 */
export class LDClient
  extends LDClientImpl
  implements
    Pick<
      LDClientCommon,
      'allFlagsState' | 'variation' | 'variationDetail' | 'waitForInitialization'
    >
{
  emitter: EventEmitter;

  // sdkKey is only used to query featureStore, not to initialize with LD servers
  constructor(sdkKey: string, featureStore: LDFeatureStore, platformInfo: Info) {
    const em = new EventEmitter();
    const platform = new EdgeFunctionPlatform(platformInfo);
    super('n/a', platform, createOptions(sdkKey, featureStore), createCallbacks(em));
    this.emitter = em;
  }

  override async waitForInitialization(): Promise<this> {
    await super.waitForInitialization();
    return this;
  }

  override track() {
    throw new Error('track is not supported');
  }

  override identify() {
    throw new Error('identify is not supported');
  }

  override isOffline(): boolean {
    throw new Error('isOffline is not supported');
  }

  override secureModeHash(): string {
    throw new Error('secureModeHash is not supported');
  }

  override close() {
    throw new Error('close is not supported');
  }

  override flush(): Promise<void> {
    throw new Error('flush is not supported');
  }
}

export default LDClient;
