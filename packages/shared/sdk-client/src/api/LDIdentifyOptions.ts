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

  /**
   * When set to true, and timeout is not set, this indicates that the identify operation will
   * not have any timeout. In typical usage, where an application awaits the promise, a timeout
   * is important because identify can potentially take indefinite time depending on network
   * conditions. If your application specifically does not block any operations pending the promise
   * resolution, then you can use this opton to explicitly indicate that.
   *
   * If you set this to true, and you do not set a timeout, and you block aspects of operation of
   * your application, then those aspects can be blocked indefinitely. Generally this option will
   * not be required.
   */
  noTimeout?: boolean;

  /**
   * If true, the identify operation will be sheddable. This means that if multiple identify operations are started without
   * waiting for the previous one to complete, then intermediate results will be discarded. When false, identify
   * operations will be queued and completed sequentially.
   *
   * By default operations will be queued and completed sequentially.
   *
   * Defaults to false.
   */
  sheddable?: boolean;

  /**
   * When true, the identify operation will return the results of the identify operation. This is useful if you want to
   * handle the results of the identify operation yourself.
   *
   * Note that in this mode, the identify promise will not reject on error, but rather, will resolve to an object
   * containing the error.
   * 
   * @remarks
   * This option should be set to true when possible. The reason for the current default is to maintain current behavior.
   * Eventually, we will make this the default behavior as part of a major version release.
   *
   * Defaults to false.
   */
  returnResults?: boolean;
}
