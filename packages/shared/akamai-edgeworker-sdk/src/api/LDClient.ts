// eslint-disable-next-line max-classes-per-file
import {
  LDClientImpl,
  LDClient as LDClientType,
  LDOptions,
} from '@launchdarkly/js-server-sdk-common';

import EdgePlatform from '../platform';
import { createCallbacks, createOptions } from '../utils';

export interface CustomLDOptions extends LDOptions {}

/**
 * The LaunchDarkly Akamai SDK edge client object.
 */
class LDClient extends LDClientImpl {
  // sdkKey is only used to query featureStore, not to initialize with LD servers
  constructor(sdkKey: string, platform: EdgePlatform, options: LDOptions) {
    const finalOptions = createOptions(options);
    super(sdkKey, platform, finalOptions, createCallbacks(finalOptions.logger));
  }

  override initialized(): boolean {
    return true;
  }

  override waitForInitialization(): Promise<LDClientType> {
    // we need to resolve the promise immediately because Akamai's runtime doesn't
    // have a setTimeout so everything executes synchronously.
    return Promise.resolve(this);
  }
}

export default LDClient;
