import { LDClient, LDOptions } from '@launchdarkly/js-server-sdk-common';

/**
 * The Cloudflare SDK only supports these 4 functions:
 *  waitForInitialization
 *  variation
 *  variationDetail
 *  allFlagsState
 * Note waitForInitialization is redefined to return Promise<LDClientCloudflare>
 * and not Promise<LDClient>
 */
type LDClientCloudflare = Pick<
  Omit<LDClient, 'waitForInitialization'>,
  'variation' | 'variationDetail' | 'allFlagsState'
> & { waitForInitialization: () => Promise<LDClientCloudflare> };

type LDOptionsCloudflare = Pick<LDOptions, 'logger' | 'featureStore'>;

export * from '@launchdarkly/js-server-sdk-common';

// override default types to retro-fit cloudflare
export { LDClientCloudflare as LDClient, LDOptionsCloudflare as LDOptions };
