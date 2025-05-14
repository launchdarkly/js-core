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
  EdgeFeatureStore,
  init as initEdge,
  internalServer,
  type LDClient,
  type LDOptions as LDOptionsCommon,
} from '@launchdarkly/js-server-sdk-common-edge';

import createPlatformInfo from './createPlatformInfo';

export {
  createMigration,
  type Cache,
  EdgeFeatureStore,
  type EdgeProvider,
  integrations,
  type LDClient,
  type LDContext,
  LDConcurrentExecution,
  type LDEvaluationDetail,
  type LDEvaluationDetailTyped,
  type LDMigration,
  LDMigrationStage,
  LDMigrationSuccess,
  type LDMethodResult,
  type LDMigrationOptions,
  type LDMigrationOpEvent,
  type LDMigrationVariation,
  type LDWaitForInitializationOptions,
} from '@launchdarkly/js-server-sdk-common-edge';

export type TtlCacheOptions = internalServer.TtlCacheOptions;

/**
 * The Launchdarkly Edge SDKs configuration options.
 */
export type LDOptions = {
  /**
   * Optional TTL cache configuration which allows for caching feature flags in
   * memory.
   */
  cache?: TtlCacheOptions;
} & LDOptionsCommon;

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
 * @param kvNamespace
 *  The Cloudflare KV configured for LaunchDarkly.
 * @param options
 *  Optional configuration settings.
 * @return
 *  The new {@link LDClient} instance.
 */
export const init = (
  clientSideID: string,
  kvNamespace: KVNamespace,
  options: LDOptions = {},
): LDClient => {
  const logger = options.logger ?? BasicLogger.get();

  const { cache: _cacheOptions, ...rest } = options;
  const cache = options.cache ? new internalServer.TtlCache(options.cache) : undefined;
  return initEdge(clientSideID, createPlatformInfo(), {
    featureStore: new EdgeFeatureStore(kvNamespace, clientSideID, 'Cloudflare', logger, cache),
    logger,
    ...rest,
  });
};
