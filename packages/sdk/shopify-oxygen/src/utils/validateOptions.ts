import { LDOptions as LDOptionsCommon } from '@launchdarkly/js-server-sdk-common';

/**
 * The Launchdarkly Oxygen SDKconfiguration options. Only logger is officially
 * supported.
 *
 * NOTE: send events might be supported in the future if we figure out outbound connection
 * support for Oxygen workers.
 */
// TODO: move this out to its own type file
export type OxygenLDOptions = Pick<LDOptionsCommon, 'logger' | 'featureStore'>;

export const validateOptions = (sdkKey: string, options: OxygenLDOptions) => {
  const { logger, featureStore, ...rest } = options;
  if (!sdkKey) {
    throw new Error('You must configure the client with a client key');
  }

  if (!logger) {
    throw new Error('You must configure the client with a logger');
  }

  // console.log('featureStore', featureStore);

  if (JSON.stringify(rest) !== '{}') {
    throw new Error(`Invalid configuration: ${Object.keys(rest).toString()} not supported`);
  }

  return true;
};
