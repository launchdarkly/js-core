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

import {
  BasicLogger,
  type BasicLoggerOptions,
  type LDLogger,
} from '@launchdarkly/js-server-sdk-common';

import { EdgeFeatureStore, EdgeProvider, LDClient } from './api';
import { DEFAULT_EVENTS_BACKEND_NAME } from './api/LDClient';
import createPlatformInfo from './createPlatformInfo';
import validateOptions, { FastlySDKOptions, LDOptionsCommon } from './utils/validateOptions';

export type {
  BasicLoggerOptions,
  LDClientContext,
  LDContext,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDEvaluationReason,
  LDFlagValue,
  LDFlagsState,
  LDFlagsStateOptions,
  LDLogger,
  LDLogLevel,
  LDMultiKindContext,
  LDSingleKindContext,
  LDWaitForInitializationOptions,
} from '@launchdarkly/js-server-sdk-common';

// BasicLogger stays available as a type so existing code keeps compiling.
// The next major version removes it from the exports. Use basicLogger() to
// create a logger.
export type { BasicLogger };

export type { EdgeProvider, FastlySDKOptions, KVStore, LDClient, LDOptionsCommon };

/**
 * The LaunchDarkly Fastly Compute SDK configuration options. This is the
 * name the other LaunchDarkly edge SDKs use for their options type.
 * It is the same type as {@link FastlySDKOptions}.
 */
export type LDOptions = FastlySDKOptions;

/**
 * Provides a simple {@link LDLogger} implementation.
 *
 * This logging implementation uses a simple format that includes only the log level
 * and the message text. Output is written to the standard error stream (`console.error`).
 * You can filter by log level as described in {@link BasicLoggerOptions.level}.
 *
 * To use the logger created by this function, put it into {@link LDOptions.logger}. If
 * you do not set {@link LDOptions.logger} to anything, the SDK uses a default logger
 * that is equivalent to `basicLogger({ level: 'info' })`.
 *
 * @param options Configuration for the logger.
 *
 * @example
 * This example shows how to use `basicLogger` in your SDK options to enable console
 * logging only at `warn` and `error` levels.
 * ```javascript
 *   const ldOptions = {
 *     logger: basicLogger({ level: 'warn' }),
 *   };
 * ```
 */
export function basicLogger(options: BasicLoggerOptions): LDLogger {
  return new BasicLogger(options);
}

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
