/**
 * Minimal type definitions for contract test utilities.
 *
 * These are compatible with the corresponding types from both
 * @launchdarkly/js-client-sdk and @launchdarkly/node-server-sdk,
 * allowing the shared package to work without depending on either SDK directly.
 */

/**
 * A minimal LDContext type compatible with both client and server SDKs.
 * Contract test harness passes context objects through without deep inspection.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LDContext = Record<string, any>;

/**
 * A minimal LDLogger interface compatible with both client and server SDKs.
 */
export interface LDLogger {
  debug(...args: any[]): void;
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

/**
 * A minimal LDEvaluationReason type compatible with both client and server SDKs.
 */
export interface LDEvaluationReason {
  kind: string;
  [key: string]: unknown;
}
