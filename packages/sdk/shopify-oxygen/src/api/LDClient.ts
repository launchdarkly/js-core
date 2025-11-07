// eslint-disable-next-line max-classes-per-file
import {
  LDClientImpl,
  LDClient as LDClientType,
  LDOptions,
} from '@launchdarkly/js-server-sdk-common';

import Platform from '../platform';
import { createCallbacks, createOptions } from '../utils';

export interface CustomLDOptions extends LDOptions {}

// TODO: consolidate this with index.ts ... it's small enough to just inline for now
/**
 * The LaunchDarkly Oxygen SDK edge client object.
 */
class LDClient extends LDClientImpl {
  // sdkKey is only used to query featureStore, not to initialize with LD servers
  constructor(sdkKey: string, platform: Platform, options: LDOptions) {
    const finalOptions = createOptions(options);
    super(sdkKey, platform, finalOptions, createCallbacks(finalOptions.logger));
  }
}

export default LDClient;
