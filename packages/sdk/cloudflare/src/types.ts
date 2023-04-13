import {
  LDClient as LDClientOriginal,
  LDOptions as LDOptionsOriginal,
} from '@launchdarkly/js-server-sdk-common';

export * from '@launchdarkly/js-server-sdk-common';

/**
 * The Cloudflare SDK only supports these 4 functions:
 *  waitForInitialization
 *  variation
 *  variationDetail
 *  allFlagsState
 */
export type LDClient = Pick<
  Omit<LDClientOriginal, 'waitForInitialization'>,
  'variation' | 'variationDetail' | 'allFlagsState'
> & { waitForInitialization: () => Promise<LDClient> };

/**
 * The Cloudflare SDK only supports the logger and featureStore options.
 */
export type LDOptions = Pick<LDOptionsOriginal, 'logger' | 'featureStore'>;
