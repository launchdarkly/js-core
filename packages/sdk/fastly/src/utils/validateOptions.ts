import { LDOptions as LDOptionsCommon } from '@launchdarkly/js-server-sdk-common';

/**
 * The Launchdarkly Edge SDKs configuration options. Only logger is officially
 * supported. sendEvents is unsupported and is only included as a beta
 * preview.
 */
export type LDOptions = Pick<LDOptionsCommon, 'logger' | 'sendEvents'>;

/**
 * The internal options include featureStore because that's how the LDClient
 * implementation expects it.
 */
export type LDOptionsInternal = LDOptions & Pick<LDOptionsCommon, 'featureStore'>;

const validateOptions = (sdkKey: string, options: LDOptionsInternal) => {
  const { featureStore, logger, sendEvents, ...rest } = options;
  if (!sdkKey) {
    throw new Error('You must configure the client with a client key');
  }

  if (!featureStore || typeof featureStore !== 'object' || !featureStore.get) {
    throw new Error('You must configure the client with a feature store');
  }

  if (!logger) {
    throw new Error('You must configure the client with a logger');
  }

  if (JSON.stringify(rest) !== '{}') {
    throw new Error(`Invalid configuration: ${Object.keys(rest).toString()} not supported`);
  }

  return true;
};

export default validateOptions;
