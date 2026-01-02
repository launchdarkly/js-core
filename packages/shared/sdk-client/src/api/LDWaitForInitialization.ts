/**
 * The waitForInitialization operation failed.
 */
export interface LDWaitForInitializationFailed {
  status: 'failed';
  error: Error;
}

/**
 * The waitForInitialization operation timed out.
 */
export interface LDWaitForInitializationTimeout {
  status: 'timeout';
}

/**
 * The waitForInitialization operation completed successfully.
 */
export interface LDWaitForInitializationComplete {
  status: 'complete';
}

/**
 * The result of the waitForInitialization operation.
 */
export type LDWaitForInitializationResult =
  | LDWaitForInitializationFailed
  | LDWaitForInitializationTimeout
  | LDWaitForInitializationComplete;

/**
 * @ignore
 * Currently these options and the waitForInitialization method signiture will mirror the one
 * that is defined in the server common. We will be consolidating this mehod so that it will
 * be common to all sdks in the future.
 */

/**
 * Options for the waitForInitialization method.
 */
export interface LDWaitForInitializationOptions {
  /**
   * The timeout duration in seconds to wait for initialization before resolving the promise.
   * If exceeded, the promise will resolve to a {@link LDWaitForInitializationTimeout} object.
   *
   * If no options are specified on the `waitForInitialization`, the default timeout of 5 seconds will be used.
   *
   * Using a high timeout, or no timeout, is not recommended because it could result in a long
   * delay when conditions prevent successful initialization.
   *
   * A value of 0 will cause the promise to resolve without waiting. In that scenario it would be
   * more effective to not call `waitForInitialization`.
   *
   * @default 5 seconds
   */
  timeout?: number;
}

