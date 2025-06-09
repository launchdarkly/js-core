/**
 * This is the API reference for the LaunchDarkly Server-Side SDK for Node.js.
 *
 * In typical usage, you will call {@link init} once at startup time to obtain an instance of
 * {@link LDClient}, which provides access to all of the SDK's functionality.
 *
 * For more information, see the SDK reference guide.
 *
 * @packageDocumentation
 */
import { BasicLogger, BasicLoggerOptions, LDLogger } from '@launchdarkly/js-server-sdk-common';

import { LDClient } from './api/LDClient';
import { LDOptions } from './api/LDOptions';
import LDClientImpl from './LDClientNode';

export * from '@launchdarkly/js-server-sdk-common';

// To replace the exports from `export *` we need to name them.
// So the below exports replace them with the Node specific variants.

// These exports are explicit to override those from common.
export { LDClient, BigSegmentStoreStatusProvider } from './api';

/**
 * Creates an instance of the LaunchDarkly client.
 *
 * Applications should instantiate a single instance for the lifetime of the application.
 * The client will begin attempting to connect to LaunchDarkly as soon as it is created. To
 * determine when it is ready to use, call {@link LDClient.waitForInitialization}, or register an
 * event listener for the `"ready"` event using {@link LDClient.on}.
 *
 * **Important:** Do **not** try to instantiate `LDClient` with its constructor
 * (`new LDClient()/new LDClientImpl()/new LDClientNode()`); the SDK does not currently support
 * this.
 *
 * @param key
 *   The SDK key.
 * @param options
 *   Optional configuration settings.
 * @return
 *   The new {@link LDClient} instance.
 */
export function init(sdkKey: string, options: LDOptions = {}): LDClient {
  return new LDClientImpl(sdkKey, options);
}

/**
 * Provides a simple {@link LDLogger} implementation.
 *
 * This logging implementation uses a simple format that includes only the log level
 * and the message text. Output is written to the standard error stream (`console.error`).
 * You can filter by log level as described in [[BasicLoggerOptions.level]].
 *
 * To use the logger created by this function, put it into {@link LDOptions.logger}. If
 * you do not set {@link LDOptions.logger} to anything, the SDK uses a default logger
 * that is equivalent to `basicLogger({ level: 'info' })`.
 *
 * @param options Configuration for the logger. If no options are specified, the
 *   logger uses `{ level: 'info' }`.
 *
 * @example
 * This example shows how to use `basicLogger` in your SDK options to enable console
 * logging only at `warn` and `error` levels.
 * ```javascript
 *   const ldOptions = {
 *     logger: basicLogger({ level: 'warn' }),
 *   };
 * ```
 *
 * @example
 * This example shows how to use `basicLogger` in your SDK options to cause log
 * output to go to `console.log` instead of `console.error`.
 * ```javascript
 *   const ldOptions = {
 *     logger: ld.basicLogger({ destination: console.log }),
 *   };
 * ```
 */
export function basicLogger(options: BasicLoggerOptions): LDLogger {
  return new BasicLogger(options);
}
