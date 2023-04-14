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
import type { LDOptions as LDOptionsCommon } from '@launchdarkly/js-server-sdk-common';
import { LDClient } from './api';

export * from '@launchdarkly/js-server-sdk-common';

export type { LDClient };

/**
 * The Cloudflare SDK only supports these options:
 * - logger
 * - featureStore
 */
export type LDOptions = Pick<LDOptionsCommon, 'logger' | 'featureStore'>;

/**
 * Creates an instance of the Cloudflare LaunchDarkly client.
 *
 * Applications should instantiate a single instance for the lifetime of the worker.
 * The client will begin attempting to connect to the configured Cloudflare KV as
 * soon as it is created. To determine when it is ready to use, call {@link ./api!LDClient.waitForInitialization}.
 *
 * **Important:** Do **not** try to instantiate `LDClient` with its constructor
 * (`new LDClient()/new LDClientImpl()/new LDClient()`); the SDK does not currently support
 * this.
 *
 * @param kvNamespace
 *   The Cloudflare KV configured with LaunchDarkly.
 * @param sdkKey
 *   The client side SDK key. This is only used to query the kvNamespace above,
 *   not to connect with LD servers.
 * @param options
 *   Optional configuration settings. The only supported options for the Cloudflare SDK
 *   are 'logger' and 'featureStore'.
 * @return
 *   The new {@link LDClient} instance.
 */
export const init = (kvNamespace: KVNamespace, sdkKey: string, options: LDOptions = {}) =>
  new LDClient(kvNamespace, sdkKey, options);
