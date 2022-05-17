export default interface LDProxyOptions {
  /**
   * Allows you to specify a host for an optional HTTP proxy.
   */
  host?: string;

  /**
   * Allows you to specify a port for an optional HTTP proxy.
   *
   * Both the host and port must be specified to enable proxy support.
   */
  port?: number;

  /**
   * When using an HTTP proxy, specifies whether it is accessed via `http` or `https`.
   */
  scheme?: string;

  /**
   * Allows you to specify basic authentication parameters for an optional HTTP proxy.
   * Usually of the form `username:password`.
   */
  auth?: string;
}
