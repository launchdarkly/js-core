import { LDOptions as LDOptionsCommon } from '@launchdarkly/js-server-sdk-common/dist/api/options/LDOptions';

/**
 * These are public options.
 * Sending events is unsupported and is only included here as a beta
 * preview.
 */
const publicOptions = ['logger', 'sendEvents'] as const;
type PublicOptions = (typeof publicOptions)[number];
export type LDOptions = Pick<LDOptionsCommon, PublicOptions>;

/**
 * The internal options include featureStore because that's how the LDClient
 * implementation expects it.
 */
type LDOptionsInternal = Pick<LDOptionsCommon, PublicOptions | 'featureStore'>;

const validateOptions = (sdkKey: string, options: LDOptionsInternal) => {
  const { featureStore, logger } = options;
  if (!sdkKey) {
    throw new Error('You must configure the client with a client key');
  }

  if (!featureStore || typeof featureStore !== 'object' || !featureStore.get) {
    throw new Error('You must configure the client with a feature store');
  }

  if (!logger) {
    throw new Error('You must configure the client with a logger');
  }

  // TODO: validate public options
  // Object.keys(options).some((o) => publicOptions.includes(o));
};

export default validateOptions;
