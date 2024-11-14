import { BasicLogger, BasicLoggerOptions, LDLogger } from '@launchdarkly/js-client-sdk-common';

import { BrowserIdentifyOptions as LDIdentifyOptions } from './BrowserIdentifyOptions';

// The exported LDIdentifyOptions and LDOptions are the browser specific implementations.
// These shadow the common implementations.
export type { LDIdentifyOptions };

export type {
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
  LDFlagValue,
  LDTimeoutError,
  LDInspection,
  LDLogger,
  LDLogLevel,
  LDMultiKindContext,
  LDSingleKindContext,
} from '@launchdarkly/js-client-sdk-common';

/**
 * Provides a basic {@link LDLogger} implementation.
 *
 * This logging implementation uses a basic format that includes only the log level
 * and the message text. By default this uses log level 'info' and the output is
 * written to `console.error`.
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
 *     logger: basicLogger({ destination: console.log }),
 *   };
 * ```
 *
 *  * @example
 * The configuration also allows you to control the destination for each log level.
 * ```javascript
 *   const ldOptions = {
 *     logger: basicLogger({
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
