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
  EdgeProvider,
  init as initEdge,
  LDClient,
  LDOptions,
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
}: AkamaiLDClientParams): LDClient =>
  initEdge({
    sdkKey,
    options,
    featureStoreProvider,
    platformName: 'Akamai EdgeWorker',
    sdkName: '@launchdarkly/akamai-server-base-sdk',
    sdkVersion: '3.0.11', // x-release-please-version
  });
