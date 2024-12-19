import * as http from 'http';
import * as https from 'https';
import * as createHttpsProxyAgent from 'https-proxy-agent';
import { HttpsProxyAgentOptions } from 'https-proxy-agent';
// No types for the event source.
// @ts-ignore
import { EventSource as LDEventSource } from 'launchdarkly-eventsource';

import {
  EventSourceCapabilities,
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
      'Proxy-Authorization': `Basic ${Buffer.from(proxyOptions.auth).toString('base64')}`,
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
  private _agent: https.Agent | http.Agent | undefined;

  private _tlsOptions: LDTLSOptions | undefined;

  private _hasProxy: boolean = false;

  private _hasProxyAuth: boolean = false;

  constructor(tlsOptions?: LDTLSOptions, proxyOptions?: LDProxyOptions, logger?: LDLogger) {
    this._agent = createAgent(tlsOptions, proxyOptions, logger);
    this._hasProxy = !!proxyOptions;
    this._hasProxyAuth = !!proxyOptions?.auth;
  }

  fetch(url: string, options: platform.Options = {}): Promise<platform.Response> {
    const isSecure = url.startsWith('https://');
    const impl = isSecure ? https : http;

    // For get requests we are going to automatically support compressed responses.
    // Note this does not affect SSE as the event source is not using this fetch implementation.
    const headers =
      options.method?.toLowerCase() === 'get'
        ? {
            ...options.headers,
            'accept-encoding': 'gzip',
          }
        : options.headers;

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
