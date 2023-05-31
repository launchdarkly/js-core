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
  BasicLogger,
  LDOptions,
  LDContext,
  LDMultiKindContext,
  LDSingleKindContext,
} from '@launchdarkly/js-server-sdk-common';
import { EdgeFeatureStore, EdgeProvider } from './edgekv/edgeFeatureStore';
import { validateOptions } from './utils';
import LDClient from './api/LDClient';
import EdgeKVProvider from './edgekv/edgeKVProvider';
import EdgePlatform from './platform';
import createPlatformInfo from './platform/info';

export type { LDClient, EdgeProvider, LDContext, LDMultiKindContext, LDSingleKindContext };

type BaseClientParams = {
  sdkKey: string;
  options?: LDOptions;
};

export type ClientWithEdgeKVParams = BaseClientParams & {
  namespace: string;
  group: string;
};

export type ClientWithFeatureStoreParams = BaseClientParams & {
  featureStoreProvider: EdgeProvider;
};

/**
 * Initialize Launchdarkly client using Akamai's Edge KV as a feature store
 * @param params ClientWithEdgeKVParams
 * @returns
 */
export const initWithEdgeKV = ({
  namespace,
  group,
  options = {},
  sdkKey,
}: ClientWithEdgeKVParams): LDClient => {
  const logger = options.logger ?? BasicLogger.get();
  const edgekvProvider = new EdgeKVProvider({ namespace, group });
  const ldOptions = {
    featureStore: new EdgeFeatureStore(edgekvProvider!, sdkKey, 'Akamai', logger),
    logger,
    ...options,
  };

  // this throws if options are invalid
  validateOptions(sdkKey, ldOptions);

  return new LDClient(sdkKey, new EdgePlatform(createPlatformInfo()), ldOptions);
};

/**
 * Initialize LaunchDarkly client using a custom feature store provider.
 * @param params ClientWithFeatureStoreParams
 * @returns
 */
export const initWithFeatureStore = ({
  sdkKey,
  options = {},
  featureStoreProvider,
}: ClientWithFeatureStoreParams): LDClient => {
  const logger = options.logger ?? BasicLogger.get();

  const ldOptions = {
    featureStore: new EdgeFeatureStore(featureStoreProvider, sdkKey, 'Akamai', logger),
    logger,
    ...options,
  };

  // this throws if options are invalid
  validateOptions(sdkKey, ldOptions);

  return new LDClient(sdkKey, new EdgePlatform(createPlatformInfo()), ldOptions);
};
