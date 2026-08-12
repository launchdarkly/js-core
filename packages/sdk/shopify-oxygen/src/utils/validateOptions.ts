import { LDOptions as LDOptionsCommon } from '@launchdarkly/js-server-sdk-common';

export type OxygenCacheOptions = {
  // Defaults to 30 seconds, LaunchDarkly's floor for polling intervals, so caching below
  // that buys nothing: a fresh poll couldn't arrive any faster anyway.
  // TODO: enforce a minimum ttlSeconds here if real-world usage turns out too noisy.
  ttlSeconds?: number;
  name?: string;
  enabled?: boolean;
};

export type OxygenLDOptions = Pick<LDOptionsCommon, 'logger' | 'sendEvents'> & {
  cache?: OxygenCacheOptions;
};

export const validateOptions = (sdkKey: string) => {
  if (!sdkKey) {
    throw new Error('You must configure the client with a client key');
  }

  return true;
};
