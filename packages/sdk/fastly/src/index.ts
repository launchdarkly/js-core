/**
 * This is the API reference for the Fastly LaunchDarkly SDK.
 *
 * In typical usage, you will call {@link init} once per request to obtain an instance of
 * {@link LDClient}, which provides access to all of the SDK's functionality.
 *
 * For more information, see the SDK reference guide.
 *
 * @packageDocumentation
 */
/// <reference types="@fastly/js-compute" />
import { KVStore } from 'fastly:kv-store';

import { BasicLogger, LDEvaluationReason } from '@launchdarkly/js-server-sdk-common';

import { EdgeFeatureStore, EdgeProvider, LDClient } from './api';
import { DEFAULT_EVENTS_BACKEND_NAME } from './api/LDClient';
import createPlatformInfo from './createPlatformInfo';
import validateOptions, { FastlySDKOptions, LDOptionsCommon } from './utils/validateOptions';

export type {
  BasicLogger,
  FastlySDKOptions,
  KVStore,
  LDClient,
  LDEvaluationReason,
  LDOptionsCommon,
};

/**
 * Creates an instance of the Fastly LaunchDarkly client.
 *
 * Applications should instantiate a single instance for the lifetime of a request.
 * The client will begin attempting to connect to the configured Fastly KV as
 * soon as it is created. To determine when it is ready to use, call {@link LDClient.waitForInitialization}.
 *
 * **Important:** Do **not** try to instantiate `LDClient` with its constructor
 * (`new LDClient()/new LDClientImpl()/new LDClient()`); the SDK does not currently support
 * this.
 *
 * @param clientSideId
 *  The client side ID. This is only used to query the kvStore above,
 *  not to connect with LaunchDarkly servers.
 * @param kvStore
 *  The Fastly KV store configured for LaunchDarkly.
 * @param options
 *  Optional {@link FastlySDKOptions | configuration settings}.
 * @return
 *  The new {@link LDClient} instance.
 */
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
