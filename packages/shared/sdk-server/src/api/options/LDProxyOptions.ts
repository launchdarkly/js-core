export interface LDProxyOptions {
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
   * Specifies the scheme used to access the proxy.
   *
   * For an HTTP proxy, use `http` (the default) or `https`. To use a SOCKS proxy instead, set
   * this to one of `socks`, `socks4`, `socks4a`, `socks5`, or `socks5h`; in that case `host` and
   * `port` identify the SOCKS proxy, and `auth` (if set) provides the `username:password`
   * credentials.
   */
  scheme?: string;

  /**
   * Allows you to specify basic authentication parameters for an optional proxy.
   * Usually of the form `username:password`.
   */
  auth?: string;
}
