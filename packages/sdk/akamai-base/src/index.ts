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
  EdgeFeatureStore,
} from '@launchdarkly/akamai-edgeworker-sdk-common';
import { BasicLogger } from '@launchdarkly/js-server-sdk-common';

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
  const logger = options.logger ?? BasicLogger.get();

  return initEdge({
    sdkKey,
    options,
    edgeFeatureStore: new EdgeFeatureStore(featureStoreProvider, sdkKey, 'Akamai', logger),
    platformName: 'Akamai EdgeWorker',
    sdkName: '@launchdarkly/akamai-server-base-sdk',
    sdkVersion: '0.3.0', // {x-release-please-version}
  });
};
