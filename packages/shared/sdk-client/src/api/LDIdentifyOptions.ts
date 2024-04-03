export interface LDIdentifyOptions {
  /**
   * Determines when the identify promise resolves if no flags have been
   * returned from the network. If you use a large timeout and await it, then
   * any network delays will cause your application to wait a long time before
   * continuing execution.
   *
   * Defaults to 5 seconds.
   */
  timeoutSeconds: number;
}
