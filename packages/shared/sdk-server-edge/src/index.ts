/**
 * This is the API reference for the Server Common Edge LaunchDarkly SDK.
 *
 * In typical usage, you will call {@link init} once at startup time to obtain an instance of
 * {@link LDClient}, which provides access to all of the SDK's functionality.
 *
 * For more information, see the SDK reference guide.
 *
 * @packageDocumentation
 */

import type { Info, LDOptions as LDOptionsCommon } from '@launchdarkly/js-server-sdk-common';
import { LDClient } from './api';
import validateOptions from './utils/validateOptions';

export * from '@launchdarkly/js-server-sdk-common';

export type { LDClient };

/**
 * Creates an instance of the LaunchDarkly edge client.
 *
 * Applications should instantiate a single instance for the lifetime of the worker.
 * The client will begin attempting to connect to the configured feature store as
 * soon as it is created. To determine when it is ready to use, call {@link LDClient.waitForInitialization}.
 *
 * **Important:** Do **not** try to instantiate `LDClient` with its constructor
 * (`new LDClient()/new LDClientImpl()/new LDClient()`); the SDK does not currently support
 * this.
 *
 * @param sdkKey
 *   The client side SDK key. This is only used to query the kvNamespace above,
 *   not to connect with LD servers.
 *   The featureStore configured with LaunchDarkly.
 * @param platformInfo
 *  The platform specific information for analytics.
 * @param options
 *  LDOptionsCommon
 * @return
 *   The new {@link LDClient} instance.
 */
export const init = (sdkKey: string, platformInfo: Info, options: LDOptionsInternal) => {
  // this throws if options are invalid
  validateOptions(sdkKey, options);
  return new LDClient(sdkKey, platformInfo, options);
};
