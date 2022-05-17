/* eslint-disable class-methods-use-this */
import { Requests } from '@launchdarkly/js-server-sdk-common';
import LDProxyOptions from '@launchdarkly/js-server-sdk-common/dist/api/options/LDProxyOptions';
import { LDTLSOptions } from '@launchdarkly/js-server-sdk-common/dist/api/options/LDTLSOptions';
import { Options, Response } from '@launchdarkly/js-server-sdk-common/dist/platform/Requests';
import createHttpsProxyAgent, { HttpsProxyAgentOptions } from 'https-proxy-agent';

import * as http from 'http';
import * as https from 'https';

import NodeResponse from './NodeResponse';

function processTlsOptions(tlsOptions: LDTLSOptions): https.AgentOptions {
  return {
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
}

function processProxyOptions(
  proxyOptions: LDProxyOptions,
  additional: https.AgentOptions = {},
): https.Agent | http.Agent {
  const protocol = proxyOptions.scheme?.startsWith('https') ? 'https:' : 'http';
  const parsedOptions: HttpsProxyAgentOptions = {
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
  return createHttpsProxyAgent(parsedOptions);
}

function createAgent(options: Options): https.Agent | http.Agent | undefined {
  if (!options.proxyOptions?.auth?.startsWith('https') && options.tlsOptions) {
    // TODO: This is likely a usage error. Need to re-address when logging is
    // figured out.
  }
  if (options.tlsOptions) {
    const agentOptions = processTlsOptions(options.tlsOptions);
    if (options.proxyOptions) {
      return processProxyOptions(options.proxyOptions, agentOptions);
    }
    return new https.Agent(agentOptions);
  } if (options.proxyOptions) {
    return processProxyOptions(options.proxyOptions);
  }
  return undefined;
}

export default class NodeRequests implements Requests {
  /**
   * @inheritdoc
   */
  fetch(url: string, options: Options = {}): Promise<Response> {
    const isSecure = url.startsWith('https://');
    const impl = isSecure ? https : http;

    return new Promise((resolve, reject) => {
      const req = impl.request(url, {
        timeout: options.timeout,
        headers: options.headers,
        method: options.method,
        agent: createAgent(options),
      }, (res) => resolve(new NodeResponse(res)));

      if (options.body) {
        req.write(options.body);
      }

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    });
  }
}
