/// <reference types="@fastly/js-compute" />
import { KVStore } from 'fastly:kv-store';

import { BasicLogger } from '@launchdarkly/js-server-sdk-common';

import { EdgeFeatureStore, EdgeProvider, LDClient } from './api';
import { DEFAULT_EVENTS_BACKEND_NAME } from './api/LDClient';
import createPlatformInfo from './createPlatformInfo';
import validateOptions, { FastlySDKOptions } from './utils/validateOptions';

export const init = (
  clientSideId: string,
  kvStore: KVStore,
  options: FastlySDKOptions = { eventsBackendName: DEFAULT_EVENTS_BACKEND_NAME },
) => {
  const logger = options.logger ?? BasicLogger.get();

  const edgeProvider: EdgeProvider = {
    get: async (rootKey: string) => {
      const entry = await kvStore.get(rootKey);
      return entry ? entry.text() : null;
    },
  };

  const finalOptions = {
    featureStore: new EdgeFeatureStore(edgeProvider, clientSideId, 'Fastly', logger),
    logger,
    ...options,
  };

  validateOptions(clientSideId, finalOptions);
  return new LDClient(clientSideId, createPlatformInfo(), finalOptions);
};
