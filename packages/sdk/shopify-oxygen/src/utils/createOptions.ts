import { BasicLogger, LDOptions } from '@launchdarkly/js-server-sdk-common';

import { OxygenLDOptions } from './validateOptions';

// The defaults below follow from Oxygen's platform constraints, documented here:
// - https://shopify.dev/docs/storefronts/headless/hydrogen/fundamentals
// - https://shopify.dev/docs/storefronts/headless/hydrogen/deployments/oxygen-runtime
export const defaultOptions: LDOptions & OxygenLDOptions = {
  // Streaming doesn't fit Oxygen workers: they aren't long-lived, and outbound requests
  // must complete within 2 minutes.
  stream: false,

  // Diagnostics send an un-awaited POST per client, and Oxygen creates one client per
  // request, so this stays off, this is consistent with our general edge sdk paradigm.
  diagnosticOptOut: true,

  // pollInterval only needs to clear that 2-minute limit, which caps this at one poll per
  // request handler execution.
  pollInterval: 300,

  logger: new BasicLogger({ name: 'Shopify Oxygen SDK' }),
  cache: {
    ttlSeconds: 30,
    name: 'launchdarkly-cache',
    enabled: true,
  },
};

export const createOptions = (
  options: LDOptions & OxygenLDOptions = {},
): LDOptions & OxygenLDOptions => {
  const finalOptions = {
    ...defaultOptions,
    ...options,
    cache: {
      ...defaultOptions.cache,
      ...options.cache,
    },
  };
  finalOptions.logger?.debug(`Using LD options: ${JSON.stringify(finalOptions)}`);
  return finalOptions;
};
