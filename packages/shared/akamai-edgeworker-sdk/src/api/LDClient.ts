// eslint-disable-next-line max-classes-per-file
import { LDClientImpl, LDOptions } from '@launchdarkly/js-server-sdk-common';
import EdgePlatform from '../platform';
import { createCallbacks, createOptions } from '../utils';

/**
 * The LaunchDarkly Akamai SDK edge client object.
 */
export default class LDClient extends LDClientImpl {
  // sdkKey is only used to query featureStore, not to initialize with LD servers
  constructor(sdkKey: string, platform: EdgePlatform, options: LDOptions) {
    super(sdkKey, platform, createOptions(options), createCallbacks());
  }
}
