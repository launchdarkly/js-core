/**
 * Options for the waitForInitialization method.
 */
export interface LDWaitForInitializationOptions {
  /**
   * The amount of time, in seconds, to wait for initialization before rejecting the promise.
   *
   * If no options are specified on the `waitForInitialization`, then the promise will resolve
   * only when initialization completes successfully or encounters a failure.
   *
   * Using a high timeout, or no timeout, is not recommended because it could result in a long
   * delay when conditions prevent successful initialization.
   *
   * A value of 0 will cause the promise to resolve without waiting. In that scenario it would be
   * more effective to not call `waitForInitialization`.
   */
  timeout: number;
}
