import { LDClientImpl, LDOptions } from '@launchdarkly/js-server-sdk-common';

import Platform from './platform';
import platformInfo from './platform/OxygenInfo';
// Polyfill timer functions for Shopify Oxygen runtime
import './polyfills/timers';
import { createCallbacks, createOptions, OxygenLDOptions, validateOptions } from './utils';

export * from '@launchdarkly/js-server-sdk-common';

class LDClient extends LDClientImpl {
  // sdkKey is only used to query featureStore, not to initialize with LD servers
  constructor(sdkKey: string, platform: Platform, options: LDOptions) {
    super(sdkKey, platform, options, createCallbacks(options.logger));
  }
}

export const init = (sdkKey: string, options: OxygenLDOptions = {}): LDClient => {
  // this throws if options are invalid
  validateOptions(sdkKey);

  const finalOptions = createOptions(options);
  const { cache: cacheOptions = {}, ...ldOptions } = finalOptions;

  return new LDClient(sdkKey, new Platform(platformInfo, cacheOptions), ldOptions);
};
