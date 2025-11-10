import { LDOptions as LDOptionsCommon } from '@launchdarkly/js-server-sdk-common';

export type OxygenCacheOptions = {
  // The time-to-live for the cache in seconds. The default is 30 seconds since that is the
  // minimum allowed polling interval for other SDKs. If this SDK is too noisy, then we can
  // enforce cache and a minimum ttl here.
  ttlSeconds?: number;
  name?: string;
  enabled?: boolean;
}

export type OxygenLDOptions = Pick<LDOptionsCommon, 'logger'> & {
  cache?:OxygenCacheOptions;
}

export const validateOptions = (sdkKey: string) => {
  if (!sdkKey) {
    throw new Error('You must configure the client with a client key');
  }

  return true;
};
