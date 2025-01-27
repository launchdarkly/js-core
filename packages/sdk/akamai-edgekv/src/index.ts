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
import {
  init as initEdge,
  LDClient,
  LDOptions as LDCommonAkamaiOptions,
} from '@launchdarkly/akamai-edgeworker-sdk-common';
import { BasicLogger } from '@launchdarkly/js-server-sdk-common';

import EdgeKVProvider from './edgekv/edgeKVProvider';

export type LDOptions = LDCommonAkamaiOptions & {
  /**
   * The time-to-live for the cache in milliseconds. The default is 100ms. A
   * value of 0 will cache indefinitely.
   */
  cacheTtlMs?: number;
};

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
  const logger = options.logger ?? BasicLogger.get();
  const cacheTtlMs = options.cacheTtlMs ?? 100;

  const edgekvProvider = new EdgeKVProvider({ namespace, group, logger });

  return initEdge({
    sdkKey,
    options: { ...options, logger, cacheTtlMs },
    featureStoreProvider: edgekvProvider,
    platformName: 'Akamai EdgeWorker',
    sdkName: '@launchdarkly/akamai-server-edgekv-sdk',
    sdkVersion: '__LD_VERSION__',
  });
};
