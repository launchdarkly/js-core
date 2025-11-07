// eslint-disable-next-line max-classes-per-file
import { BasicLogger, LDOptions } from '@launchdarkly/js-server-sdk-common';

// Most limitations could be explained in the following references:
// - https://shopify.dev/docs/storefronts/headless/hydrogen/fundamentals
// - https://shopify.dev/docs/storefronts/headless/hydrogen/deployments/oxygen-runtime
export const defaultOptions: LDOptions = {
  // Streaming does not make sense for Oxygen worker environments as they are not designed to be long-lived.
  // Specifically "Outbound API requests must complete within 2 minutes"
  stream: false,
  // TODO: need to figure out if we want to support sending events
  // sendEvents: false,
  // TODO: make sure this is necessary
  diagnosticOptOut: true,

  // 2 minutes is the maximum allowed time for outbound API requests
  // so we set this to anything above that since we only want to have 1
  // poll request per request handler execution.
  pollInterval: 300,
  // TODO: figure out what needs to be done for relay proxy support?
  // useLdd: true,
  logger: new BasicLogger({ name: 'Shopify Oxygen SDK', level: 'debug' }),
};

export const createOptions = (options: LDOptions) => {
  const finalOptions = { ...defaultOptions, ...options };
  finalOptions.logger?.debug(`Using LD options: ${JSON.stringify(finalOptions)}`);
  return finalOptions;
};
