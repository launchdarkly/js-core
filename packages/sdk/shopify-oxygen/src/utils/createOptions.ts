// eslint-disable-next-line max-classes-per-file
import { BasicLogger, LDOptions } from '@launchdarkly/js-server-sdk-common';

import { OxygenLDOptions } from './validateOptions';

// Most limitations could be explained in the following references:
// - https://shopify.dev/docs/storefronts/headless/hydrogen/fundamentals
// - https://shopify.dev/docs/storefronts/headless/hydrogen/deployments/oxygen-runtime
export const defaultOptions: LDOptions & OxygenLDOptions = {
  // Streaming does not make sense for Oxygen worker environments as they are not designed to be long-lived.
  // Specifically "Outbound API requests must complete within 2 minutes"
  stream: false,

  // TODO: make sure this is necessary
  diagnosticOptOut: true,

  // 2 minutes is the maximum allowed time for outbound API requests
  // so we set this to anything above that since we only want to have 1
  // poll request per request handler execution.
  pollInterval: 300,

  logger: new BasicLogger({ name: 'Shopify Oxygen SDK' }),
  cache: {
    ttlSeconds: 30,
    name: 'launchdarkly-cache',
    enabled: true,
  },
};

export const createOptions = (options: LDOptions & OxygenLDOptions = {}) => {
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
