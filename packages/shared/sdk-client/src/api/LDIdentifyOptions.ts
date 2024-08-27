export interface LDIdentifyOptions {
  /**
   * In seconds. Determines when the identify promise resolves if no flags have been
   * returned from the network. If you use a large timeout and await it, then
   * any network delays will cause your application to wait a long time before
   * continuing execution.
   *
   * Defaults to 5 seconds.
   */
  timeout?: number;

  /**
   * When true indicates that the SDK will attempt to wait for values from
   * LaunchDarkly instead of depending on cached values. The cached values will
   * still be loaded, but the promise returned by the identify function will not
   * resolve as a result of those cached values being loaded. Generally this
   * option should NOT be used and instead flag changes should be listened to.
   * If the client is set to offline mode, then this option is ignored.
   *
   * Defaults to false.
   */
  waitForNetworkResults?: boolean;
}
