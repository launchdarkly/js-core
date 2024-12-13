/// <reference types="@fastly/js-compute" />
import { KVStore } from 'fastly:kv-store';

import {
  BasicLogger,
  EdgeFeatureStore,
  EdgeProvider,
  init as initEdge,
  LDOptions,
} from '@launchdarkly/js-server-sdk-common-edge';

import createPlatformInfo from './createPlatformInfo';

export const init = (kvStore: KVStore, sdkKey: string, options: LDOptions = {}) => {
  const logger = options.logger ?? BasicLogger.get();

  const edgeProvider: EdgeProvider = {
    get: async (rootKey: string) => {
      const entry = await kvStore.get(rootKey);
      return entry ? await entry.text() : null;
    },
  };

  return initEdge(sdkKey, createPlatformInfo(), {
    featureStore: new EdgeFeatureStore(edgeProvider, sdkKey, 'Fastly', logger),
    logger,
    additionalFetchOptions: {
      backend: 'launchdarkly',
    },
    ...options,
  });
};
