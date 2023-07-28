import * as http from 'http';
import * as https from 'https';
import * as createHttpsProxyAgent from 'https-proxy-agent';
import { HttpsProxyAgentOptions } from 'https-proxy-agent';
// No types for the event source.
// @ts-ignore
import { EventSource as LDEventSource } from 'launchdarkly-eventsource';

import {
  LDLogger,
  LDProxyOptions,
  LDTLSOptions,
  platform,
} from '@launchdarkly/js-server-sdk-common';

import NodeResponse from './NodeResponse';

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

function processProxyOptions(
  proxyOptions: LDProxyOptions,
  additional: https.AgentOptions = {},
): https.Agent | http.Agent {
  const protocol = proxyOptions.scheme?.startsWith('https') ? 'https:' : 'http';
  const parsedOptions: HttpsProxyAgentOptions & { [index: string]: any } = {
    port: proxyOptions.port,
    host: proxyOptions.host,
    protocol,
    ...additional,
  };
  if (proxyOptions.auth) {
    parsedOptions.headers = {
      'Proxy-Authorization': `Basic ${Buffer.from(proxyOptions.auth).toString('base64')}}`,
    };
  }

  // Node does not take kindly to undefined keys.
  Object.keys(parsedOptions).forEach((key) => {
    if (parsedOptions[key] === undefined) {
      delete parsedOptions[key];
    }
  });

  return createHttpsProxyAgent(parsedOptions);
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
  private agent: https.Agent | http.Agent | undefined;

  private tlsOptions: LDTLSOptions | undefined;

  private hasProxy: boolean = false;

  private hasProxyAuth: boolean = false;

  constructor(tlsOptions?: LDTLSOptions, proxyOptions?: LDProxyOptions, logger?: LDLogger) {
    this.agent = createAgent(tlsOptions, proxyOptions, logger);
    this.hasProxy = !!proxyOptions;
    this.hasProxyAuth = !!proxyOptions?.auth;
  }

  fetch(url: string, options: platform.Options = {}): Promise<platform.Response> {
    const isSecure = url.startsWith('https://');
    const impl = isSecure ? https : http;

    return new Promise((resolve, reject) => {
      const req = impl.request(
        url,
        {
          timeout: options.timeout,
          headers: options.headers,
          method: options.method,
          agent: this.agent,
        },
        (res) => resolve(new NodeResponse(res)),
      );

      if (options.body) {
        req.write(options.body);
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
      agent: this.agent,
      tlsParams: this.tlsOptions,
    };
    return new LDEventSource(url, expandedOptions);
  }

  usingProxy(): boolean {
    return this.hasProxy;
  }

  usingProxyAuth(): boolean {
    return this.hasProxyAuth;
  }
}
