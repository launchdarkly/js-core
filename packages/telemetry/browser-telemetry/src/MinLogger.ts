/**
 * Minimal logging implementation. Compatible with an LDLogger.
 *
 * implementation node: Does not use a logging implementation exported by the SDK.
 * This allows usage with multiple SDK versions.
 */
export interface MinLogger {
  warn(...args: any[]): void;
}
