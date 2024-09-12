/**
 * This is the API reference for the Cloudflare Netlify SDK.
 *
 * In typical usage, you will call {@link init} once at startup time to obtain an instance of
 * {@link LDClient}, which provides access to all of the SDK's functionality.
 *
 * For more information, see the SDK reference guide.
 *
 * @packageDocumentation
 */
import { getStore } from '@netlify/blobs';

import {
  BasicLogger,
  EdgeFeatureStore,
  EdgeProvider,
  init as initEdge,
  type LDClient,
  type LDOptions,
} from '@launchdarkly/js-server-sdk-common-edge';

import createPlatformInfo from './createPlatformInfo';

export * from '@launchdarkly/js-server-sdk-common-edge';

export type { LDClient };

/**
 * Creates an instance of the Cloudflare LaunchDarkly client.
 *
 * Applications should instantiate a single instance for the lifetime of the worker.
 * The client will begin attempting to connect to the configured Cloudflare KV as
 * soon as it is created. To determine when it is ready to use, call {@link LDClient.waitForInitialization}.
 *
 * **Important:** Do **not** try to instantiate `LDClient` with its constructor
 * (`new LDClient()/new LDClientImpl()/new LDClient()`); the SDK does not currently support
 * this.
 *
 * @param clientSideID
 *  The client side ID. This is only used to query the kvNamespace above,
 *  not to connect with LaunchDarkly servers.
 * @param options
 *  Optional configuration settings. The only supported option is logger.
 * @return
 *  The new {@link LDClient} instance.
 */
export const init = (clientSideID: string, options: LDOptions = {}): LDClient => {
  const logger = options.logger ?? BasicLogger.get();
  const edgeProvider: EdgeProvider = {
    get: async (_rootKey: string) => {
      const blobs = getStore('official-launchdarkly');
      return blobs.get('default');
    },
  };
  return initEdge(clientSideID, createPlatformInfo(), {
    featureStore: new EdgeFeatureStore(edgeProvider, clientSideID, 'Netlify', logger),
    logger,
    ...options,
  });
};
