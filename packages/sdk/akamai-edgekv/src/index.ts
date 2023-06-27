/**
 * This is the API reference for the Akamai LaunchDarkly SDK using EdgeKV as a feature store.
 *
 * In typical usage, you will call {@link init} once at startup time to obtain an instance of
 * {@link LDClient}, which provides access to all of the SDK's functionality.
 *
 * For more information, see the SDK reference guide.
 *
 * @packageDocumentation
 */

import { init as initEdge, LDClient, LDOptions } from '@launchdarkly/akamai-edgeworker-sdk-common';
import EdgeKVProvider from './edgekv/edgeKVProvider';

export * from '@launchdarkly/akamai-edgeworker-sdk-common';

export type AkamaiLDClientParams = {
  sdkKey: string;
  options?: LDOptions;
  namespace: string;
  group: string;
};

/**
 * Initialize Launchdarkly client using Akamai's Edge KV as a feature store
 * @param params ClientWithEdgeKVParams
 * @returns
 */
export const init = ({
  namespace,
  group,
  options = {},
  sdkKey,
}: AkamaiLDClientParams): LDClient => {
  const edgekvProvider = new EdgeKVProvider({ namespace, group });

  return initEdge({
    sdkKey,
    options,
    featureStoreProvider: edgekvProvider,
    platformName: 'Akamai EdgeWorker',
    sdkName: '@launchdarkly/akamai-server-edgekv-sdk',
    sdkVersion: '__LD_VERSION__',
  });
};
