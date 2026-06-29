import * as http from 'http';
import * as https from 'https';
import { HttpsProxyAgent, HttpsProxyAgentOptions } from 'https-proxy-agent';
// No types for the event source.
// @ts-ignore
import { EventSource as LDEventSource } from 'launchdarkly-eventsource';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { format as formatUrl } from 'url';
import { promisify } from 'util';
import * as zlib from 'zlib';

import {
  EventSourceCapabilities,
  LDLogger,
  LDProxyOptions,
  LDTLSOptions,
  platform,
} from '@launchdarkly/js-server-sdk-common';

import NodeResponse from './NodeResponse';

const gzip = promisify(zlib.gzip);

function processTlsOptions(tlsOptions: LDTLSOptions): https.AgentOptions {
  const options: https.AgentOptions & { [index: string]: any } = {
    ca: tlsOptions.ca,
    cert: tlsOptions.cert,
    checkServerIdentity: tlsOptions.checkServerIdentity,
    ciphers: tlsOptions.ciphers,
    // Our interface says object for the pfx object. But the node
    // type is more strict. This is also true for the key and KeyObject.
    // @ts-ignore
    pfx: tlsOptions.pfx,
    // @ts-ignore
    key: tlsOptions.key,
    passphrase: tlsOptions.passphrase,
    rejectUnauthorized: tlsOptions.rejectUnauthorized,
    secureProtocol: tlsOptions.secureProtocol,
    servername: tlsOptions.servername,
  };

  // Node does not take kindly to undefined keys.
  Object.keys(options).forEach((key) => {
    if (options[key] === undefined) {
      delete options[key];
    }
  });

  return options;
}

const socksSchemes = ['socks', 'socks4', 'socks4a', 'socks5', 'socks5h'];

function isSocksScheme(scheme?: string): boolean {
  return scheme !== undefined && socksSchemes.includes(scheme);
}

function processSocksProxyOptions(
  proxyOptions: LDProxyOptions,
  additional: https.AgentOptions = {},
): https.Agent | http.Agent {
  // A single SOCKS agent works for both http and https targets. Build the proxy address as a URL
  // so its username/password setters percent-encode the credentials; socks-proxy-agent decodes
  // them again, which means an `auth` password may safely contain characters such as ':'.
  // Assemble the address with formatUrl (the same handling the http proxy path uses) so IPv6
  // literal hosts are bracketed and a missing port is omitted rather than appended as the
  // literal string 'undefined'.
  const proxyUrl = new URL(
    formatUrl({
      protocol: `${proxyOptions.scheme}:`,
      slashes: true,
      hostname: proxyOptions.host,
      port: proxyOptions.port,
    }),
  );
  if (proxyOptions.auth) {
    const [userId, ...passwordParts] = proxyOptions.auth.split(':');
    proxyUrl.username = userId;
    proxyUrl.password = passwordParts.join(':');
  }
  const agent = new SocksProxyAgent(proxyUrl, additional);
  // socks-proxy-agent derives the proxy host from URL.hostname, which keeps the surrounding
  // brackets on an IPv6 literal (e.g. '[::1]'). The underlying socks client passes that host
  // straight to net.connect, which cannot resolve a bracketed literal, so strip the brackets.
  if (agent.proxy.host?.startsWith('[') && agent.proxy.host.endsWith(']')) {
    agent.proxy.host = agent.proxy.host.slice(1, -1);
  }
  return agent;
}

function processProxyOptions(
  proxyOptions: LDProxyOptions,
  additional: https.AgentOptions = {},
): https.Agent | http.Agent {
  if (isSocksScheme(proxyOptions.scheme)) {
    return processSocksProxyOptions(proxyOptions, additional);
  }

  const proxyUrl = formatUrl({
    protocol: proxyOptions.scheme?.startsWith('https') ? 'https:' : 'http:',
    slashes: true,
    hostname: proxyOptions.host,
    port: proxyOptions.port,
  });
  const parsedOptions: HttpsProxyAgentOptions<string> = {
    ...additional,
  };
  if (proxyOptions.auth) {
    parsedOptions.headers = {
      'Proxy-Authorization': `Basic ${Buffer.from(proxyOptions.auth).toString('base64')}`,
    };
  }

  // Node does not take kindly to undefined keys.
  Object.keys(parsedOptions).forEach((key) => {
    if (parsedOptions[key as keyof HttpsProxyAgentOptions<string>] === undefined) {
      delete parsedOptions[key as keyof HttpsProxyAgentOptions<string>];
    }
  });

  return new HttpsProxyAgent(proxyUrl, parsedOptions);
}

function createAgent(
  tlsOptions?: LDTLSOptions,
  proxyOptions?: LDProxyOptions,
  logger?: LDLogger,
): https.Agent | http.Agent | undefined {
  if (!proxyOptions?.auth?.startsWith('https') && tlsOptions) {
    logger?.warn('Proxy configured with TLS options, but is not using an https auth.');
  }
  if (tlsOptions) {
    const agentOptions = processTlsOptions(tlsOptions);
    if (proxyOptions) {
      return processProxyOptions(proxyOptions, agentOptions);
    }
    return new https.Agent(agentOptions);
  }
  if (proxyOptions) {
    return processProxyOptions(proxyOptions);
  }
  return undefined;
}

export default class NodeRequests implements platform.Requests {
  private _agent: https.Agent | http.Agent | undefined;

  private _tlsOptions: LDTLSOptions | undefined;

  private _hasProxy: boolean = false;

  private _hasProxyAuth: boolean = false;

  private _enableBodyCompression: boolean = false;

  constructor(
    tlsOptions?: LDTLSOptions,
    proxyOptions?: LDProxyOptions,
    logger?: LDLogger,
    enableEventCompression?: boolean,
  ) {
    this._agent = createAgent(tlsOptions, proxyOptions, logger);
    this._hasProxy = !!proxyOptions;
    this._hasProxyAuth = !!proxyOptions?.auth;
    this._enableBodyCompression = !!enableEventCompression;
  }

  async fetch(url: string, options: platform.Options = {}): Promise<platform.Response> {
    const isSecure = url.startsWith('https://');
    const impl = isSecure ? https : http;

    const headers = { ...options.headers };
    let bodyData: string | Buffer | undefined = options.body;

    // For get requests we are going to automatically support compressed responses.
    // Note this does not affect SSE as the event source is not using this fetch implementation.
    if (options.method?.toLowerCase() === 'get') {
      headers['accept-encoding'] = 'gzip';
    }
    // For post requests we are going to support compressed post bodies if the
    // enableEventCompression config setting is true and the compressBodyIfPossible
    // option is true.
    else if (
      this._enableBodyCompression &&
      !!options.compressBodyIfPossible &&
      options.method?.toLowerCase() === 'post' &&
      options.body
    ) {
      headers['content-encoding'] = 'gzip';
      bodyData = await gzip(Buffer.from(options.body, 'utf8'));
    }

    return new Promise((resolve, reject) => {
      const req = impl.request(
        url,
        {
          timeout: options.timeout,
          headers,
          method: options.method,
          agent: this._agent,
        },
        (res) => resolve(new NodeResponse(res)),
      );

      if (bodyData) {
        req.write(bodyData);
      }

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    });
  }

  createEventSource(
    url: string,
    eventSourceInitDict: platform.EventSourceInitDict,
  ): platform.EventSource {
    const expandedOptions = {
      ...eventSourceInitDict,
      agent: this._agent,
      tlsParams: this._tlsOptions,
      maxBackoffMillis: 30 * 1000,
      jitterRatio: 0.5,
    };
    return new LDEventSource(url, expandedOptions);
  }

  getEventSourceCapabilities(): EventSourceCapabilities {
    return {
      readTimeout: true,
      headers: true,
      customMethod: true,
    };
  }

  usingProxy(): boolean {
    return this._hasProxy;
  }

  usingProxyAuth(): boolean {
    return this._hasProxyAuth;
  }
}
