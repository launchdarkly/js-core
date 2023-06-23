/**
 * This is the API reference for the Akamai LaunchDarkly SDK.
 *
 * In typical usage, you will call {@link init} once at startup time to obtain an instance of
 * {@link LDClient}, which provides access to all of the SDK's functionality.
 *
 * For more information, see the SDK reference guide.
 *
 * @packageDocumentation
 */

import {
  init as initEdge,
  LDClient,
  LDOptions,
  EdgeProvider,
} from '@launchdarkly/akamai-edgeworker-sdk-common';

export * from '@launchdarkly/akamai-edgeworker-sdk-common';

export type AkamaiLDClientParams = {
  sdkKey: string;
  options?: LDOptions;
  featureStoreProvider: EdgeProvider;
};

/**
 * Initialize Launchdarkly client using Akamai's Edge KV as a feature store
 * @param params ClientWithEdgeKVParams
 * @returns
 */
export const init = ({
  options = {},
  sdkKey,
  featureStoreProvider,
}: AkamaiLDClientParams): LDClient => {
  return initEdge({
    sdkKey,
    options,
    featureStoreProvider,
    platformName: 'Akamai EdgeWorker',
    sdkName: '@launchdarkly/akamai-server-base-sdk',
    sdkVersion: '__LD_VERSION__',
  });
};
