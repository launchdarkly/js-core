import * as http from 'http';
import * as https from 'https';

import { LDOptions as LDOptionsCommon } from '@launchdarkly/js-server-sdk-common';

import { LDPlugin } from './LDPlugin';

/**
 * LaunchDarkly initialization options.
 *
 * @privateRemarks
 * The plugins implementation is SDK specific, so these options exist to extend the base options
 * with the node specific plugin configuration.
 */
export interface LDOptions extends LDOptionsCommon {
  /**
   * A list of plugins to be used with the SDK.
   *
   * Plugin support is currently experimental and subject to change.
   */
  plugins?: LDPlugin[];

  /**
   * An HTTP(S) agent used for all outgoing SDK connections.
   *
   * This is an extension point for proxy configurations the SDK does not build itself. For a
   * basic HTTP/HTTPS proxy, prefer {@link LDOptionsCommon.proxyOptions}. For other schemes (for
   * example a SOCKS proxy), construct the appropriate agent (such as `SocksProxyAgent` from the
   * `socks-proxy-agent` package) and supply it here.
   *
   * When this is set, `proxyOptions` and `tlsParams` are ignored, because the agent is
   * responsible for connection and TLS setup.
   *
   * @remarks
   * The SDK cannot inspect a caller-supplied agent, so diagnostic reporting treats any agent
   * supplied here as a best-effort signal that a proxy is in use. This may be inaccurate if the
   * agent is used for something other than proxying, such as custom certificates. Credentials
   * carried by the agent itself (for example a SOCKS URL's embedded username/password) are not
   * reflected in proxy-authentication diagnostics, since the SDK has no way to inspect them.
   */
  proxyAgent?: https.Agent | http.Agent;
}
