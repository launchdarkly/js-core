// eslint-disable-next-line max-classes-per-file
import {
  LDClient as LDClientType,
  LDClientImpl,
  LDOptions,
} from '@launchdarkly/js-server-sdk-common';
import EdgePlatform from '../platform';
import { createCallbacks, createOptions } from '../utils';

/**
 * The LaunchDarkly Akamai SDK edge client object.
 */
class LDClient extends LDClientImpl {
  // sdkKey is only used to query featureStore, not to initialize with LD servers
  constructor(sdkKey: string, platform: EdgePlatform, options: LDOptions) {
    super(sdkKey, platform, createOptions(options), createCallbacks());
  }

  override waitForInitialization(): Promise<LDClientType> {
    // we need to resolve the promise immediately because Akamai's runtime doesnt
    // have a setimeout so everything executes synchronously.
    return Promise.resolve(this);
  }
}

export default LDClient;
