/**
 * This is the API reference for the EdgeFunction LaunchDarkly SDK.
 *
 * In typical usage, you will call {@link init} once at startup time to obtain an instance of
 * {@link LDClientEdgeFunction}, which provides access to all of the SDK's functionality.
 *
 * For more information, see the SDK reference guide.
 *
 * @packageDocumentation
 */

import type { Info, LDFeatureStore } from '@launchdarkly/js-server-sdk-common';
import { LDClientEdgeFunction } from './api';

export * from '@launchdarkly/js-server-sdk-common';

export type { LDClientEdgeFunction };

/**
 * Creates an instance of the EdgeFunction LaunchDarkly client.
 *
 * Applications should instantiate a single instance for the lifetime of the worker.
 * The client will begin attempting to connect to the configured feature store as
 * soon as it is created. To determine when it is ready to use, call {@link LDClientEdgeFunction.waitForInitialization}.
 *
 * **Important:** Do **not** try to instantiate `LDClient` with its constructor
 * (`new LDClient()/new LDClientImpl()/new LDClient()`); the SDK does not currently support
 * this.
 *
 * @param sdkKey
 *   The client side SDK key. This is only used to query the kvNamespace above,
 *   not to connect with LD servers.
 * @param featureStore
 *   The featureStore configured with LaunchDarkly.
 * @param platformInfo
 *  The platform specific information for analytics purposes.
 * @return
 *   The new {@link LDClientEdgeFunction} instance.
 */
export const init = (sdkKey: string, featureStore: LDFeatureStore, platformInfo: Info) =>
  new LDClientEdgeFunction(sdkKey, featureStore, platformInfo);
