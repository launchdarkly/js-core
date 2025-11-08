// Polyfill timer functions for Shopify Oxygen runtime
import { BasicLogger, LDOptions as LDOptionsCommon } from '@launchdarkly/js-server-sdk-common';

import LDClient from './api/LDClient';
import Platform from './platform';
import platformInfo from './platform/OxygenInfo';
import './polyfills/timers';
import { validateOptions } from './utils';
import { OxygenCacheOptions } from './platform/OxygenRequests';

// TODO: maybe add in the TTL option here when we figure out how to plug this into the cache
type LDOptions = {
  cache?: OxygenCacheOptions;
} & Pick<LDOptionsCommon, 'logger'>;

export * from '@launchdarkly/js-server-sdk-common';

export const init = (sdkKey: string, options: LDOptions = {}): LDClient => {
  // NOTE clean this up there is another instance of this that is not being used
  const logger = options.logger ?? new BasicLogger({ name: 'Shopify Oxygen SDK', level: 'debug' });
  const { cache: cacheOptions = {}, ...restOptions } = options;

  const ldOptions: LDOptionsCommon = {
    logger,
    ...restOptions,
  };

  // this throws if options are invalid
  // TODO: need to confirm the options here
  validateOptions(sdkKey, ldOptions);

  return new LDClient(sdkKey, new Platform(platformInfo, cacheOptions), ldOptions);
};
