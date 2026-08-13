import {
  LDClientImpl,
  LDOptions,
  ServerInternalOptions,
} from '@launchdarkly/js-server-sdk-common';

import Platform from './platform';
import platformInfo from './platform/OxygenInfo';
// Polyfill timer functions for Shopify Oxygen runtime
import './polyfills/timers';
import { createCallbacks, createOptions, OxygenLDOptions, validateOptions } from './utils';

export * from '@launchdarkly/js-server-sdk-common';
export type { OxygenLDOptions };

class LDClient extends LDClientImpl {
  constructor(sdkKey: string, platform: Platform, options: LDOptions) {
    const internalOptions: ServerInternalOptions = {
      // Oxygen's execution context ends when the response is returned, which makes keeping a
      // background flush loop meaningless.
      disableBackgroundEventFlush: true,
      userAgentHeaderName: 'x-launchdarkly-user-agent',
    };
    super(sdkKey, platform, options, createCallbacks(options.logger), internalOptions);
  }
}

export const init = (sdkKey: string, options: OxygenLDOptions = {}): LDClient => {
  // this throws if options are invalid
  validateOptions(sdkKey);

  const finalOptions = createOptions(options);
  const { cache: cacheOptions = {}, ...ldOptions } = finalOptions;

  return new LDClient(sdkKey, new Platform(platformInfo, cacheOptions), ldOptions);
};
