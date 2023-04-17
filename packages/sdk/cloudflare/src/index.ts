/**
 * This is the API reference for the Cloudflare LaunchDarkly SDK.
 *
 * In typical usage, you will call {@link init} once at startup time to obtain an instance of
 * {@link LDClient}, which provides access to all of the SDK's functionality.
 *
 * For more information, see the SDK reference guide.
 *
 * @packageDocumentation
 */
import type { KVNamespace } from '@cloudflare/workers-types';
import {
  BasicLogger,
  init as initEdge,
  LDClient,
  LDOptions,
} from '@launchdarkly/js-server-sdk-common-edge';
import createFeatureStore from './createFeatureStore';
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
 * @param kvNamespace
 *  The Cloudflare KV configured with LaunchDarkly.
 * @param sdkKey
 *  The client side SDK key. This is only used to query the kvNamespace above,
 *   not to connect with LD servers.
 * @param options
 *  The only supported option is 'logger'
 * @return
 *  The new {@link LDClient} instance.
 */
export const init = (sdkKey: string, kvNamespace: KVNamespace, options: LDOptions = {}) => {
  const logger = options.logger ?? BasicLogger.get();
  return initEdge(sdkKey, createPlatformInfo(), {
    featureStore: createFeatureStore(kvNamespace, sdkKey, logger),
    logger,
    ...options,
  });
};
