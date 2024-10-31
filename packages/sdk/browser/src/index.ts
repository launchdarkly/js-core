/**
 * This is the API reference for the LaunchDarkly Client-Side SDK for JavaScript.
 *
 * This SDK is intended for use in browser environments.
 *
 * In typical usage, you will call {@link initialize} once at startup time to obtain an instance of
 * {@link LDClient}, which provides access to all of the SDK's functionality.
 *
 * For more information, see the SDK reference guide.
 *
 * @packageDocumentation
 */
import {
  AutoEnvAttributes,
  BasicLogger,
  BasicLoggerOptions,
  EvaluationSeriesContext,
  EvaluationSeriesData,
  Hook,
  HookMetadata,
  IdentifySeriesContext,
  IdentifySeriesData,
  IdentifySeriesResult,
  IdentifySeriesStatus,
  LDContext,
  LDContextCommon,
  LDContextMeta,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDEvaluationReason,
  LDFlagSet,
  LDLogger,
  LDLogLevel,
  LDMultiKindContext,
  LDSingleKindContext,
} from '@launchdarkly/js-client-sdk-common';

// The exported LDClient and LDOptions are the browser specific implementations.
// These shadow the common implementations.
import { BrowserClient, LDClient } from './BrowserClient';
import { BrowserIdentifyOptions as LDIdentifyOptions } from './BrowserIdentifyOptions';
import { BrowserOptions as LDOptions } from './options';

export type {
  LDClient,
  LDFlagSet,
  LDContext,
  LDContextCommon,
  LDContextMeta,
  LDMultiKindContext,
  LDSingleKindContext,
  LDLogLevel,
  LDLogger,
  LDOptions,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDEvaluationReason,
  LDIdentifyOptions,
  Hook,
  HookMetadata,
  EvaluationSeriesContext,
  EvaluationSeriesData,
  IdentifySeriesContext,
  IdentifySeriesData,
  IdentifySeriesResult,
  IdentifySeriesStatus,
};

/**
 * Creates an instance of the LaunchDarkly client.
 *
 * Usage:
 * ```
 * import { initialize } from 'launchdarkly-js-client-sdk';
 * const client = initialize(envKey, context, options);
 * ```
 *
 * @param clientSideId
 *   The client-side id, also known as the environment ID.
 * @param options
 *   Optional configuration settings.
 * @return
 *   The new client instance.
 */
export function initialize(clientSideId: string, options?: LDOptions): LDClient {
  // AutoEnvAttributes are not supported yet in the browser SDK.
  return new BrowserClient(clientSideId, AutoEnvAttributes.Disabled, options);
}

/**
 * Provides a simple {@link LDLogger} implementation.
 *
 * This logging implementation uses a simple format that includes only the log level
 * and the message text. By default the output is written to `console.error`.
 *
 * To use the logger created by this function, put it into {@link LDOptions.logger}. If
 * you do not set {@link LDOptions.logger} to anything, the SDK uses a default logger
 * that will log "info" level and higher priorty messages and it will log messages to
 * console.info, console.warn, and console.error.
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
 * This example shows how to use `basicLogger` in your SDK options to cause all
 * log output to go to `console.log`
 * ```javascript
 *   const ldOptions = {
 *     logger: ld.basicLogger({ destination: console.log }),
 *   };
 * ```
 *
 *  * @example
 * The configuration also allows you to control the destination for each log level.
 * ```javascript
 *   const ldOptions = {
 *     logger: ld.basicLogger({
 *       destination: {
 *         debug: console.debug,
 *         info: console.info,
 *         warn: console.warn,
 *         error:console.error
 *       }
 *     }),
 *   };
 * ```
 */
export function basicLogger(options: BasicLoggerOptions): LDLogger {
  return new BasicLogger(options);
}
