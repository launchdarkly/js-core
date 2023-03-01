/**
 * Logging levels that can be used with {@link basicLogger}.
 *
 * Set{@link BasicLoggerOptions.level} to one of these values to control what levels
 * of log messages are enabled. Going from lowest importance (and most verbose)
 * to most importance, the levels are `'debug'`, `'info'`, `'warn'`, and `'error'`.
 * You can also specify `'none'` instead to disable all logging.
 */
export type LDLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';
