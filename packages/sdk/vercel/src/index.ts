/**
 * This is the API reference for the Vercel LaunchDarkly SDK.
 *
 * In typical usage, you will call {@link init} once at startup time to obtain an instance of
 * {@link LDClient}, which provides access to all of the SDK's functionality.
 *
 * For more information, see the SDK reference guide.
 *
 * @packageDocumentation
 */
import type { EdgeConfigClient } from '@vercel/edge-config';

import {
  BasicLogger,
  EdgeFeatureStore,
  EdgeProvider,
  init as initEdge,
  LDClient,
  LDOptions,
} from '@launchdarkly/js-server-sdk-common-edge';

import createPlatformInfo from './createPlatformInfo';

export * from '@launchdarkly/js-server-sdk-common-edge';

export type { LDClient };

/**
 * Creates an instance of the Vercel LaunchDarkly client.
 *
 * Applications should instantiate a single instance for the lifetime of the worker.
 * The client will begin attempting to connect to the configured Vercel Edge Config as
 * soon as it is created. To determine when it is ready to use, call {@link LDClient.waitForInitialization}.
 *
 * **Important:** Do **not** try to instantiate `LDClient` with its constructor
 * (`new LDClient()/new LDClientImpl()/new LDClient()`); the SDK does not currently support
 * this.
 *
 * @param clientSideID
 *  The client-side ID. This is only used to query the edgeConfig above,
 *  not to connect with LaunchDarkly servers.
 * @param edgeConfig
 *  The Vercel Edge Config client configured for LaunchDarkly.
 * @param options
 *  Optional configuration settings.
 * @return
 *  The new {@link LDClient} instance.
 */
export const init = (
  clientSideID: string,
  edgeConfig: EdgeConfigClient,
  options: LDOptions = {},
) => {
  const logger = options.logger ?? BasicLogger.get();

  // vercel does not support string gets so we have to stringify it
  const edgeProvider: EdgeProvider = {
    get: async (rootKey: string) => {
      const json = await edgeConfig.get(rootKey);
      return json ? JSON.stringify(json) : null;
    },
  };

  return initEdge(clientSideID, createPlatformInfo(), {
    featureStore: new EdgeFeatureStore(edgeProvider, clientSideID, 'Vercel', logger),
    logger,
    ...options,
  });
};
