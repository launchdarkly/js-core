import * as http from 'http';
import * as https from 'https';
// No types for the event source.
// @ts-ignore
import { EventSource as LDEventSource } from 'launchdarkly-eventsource';
import { promisify } from 'util';
import * as zlib from 'zlib';

import { EventSourceCapabilities, platform } from '@launchdarkly/js-client-sdk-common';

import type { LDTLSOptions } from '../NodeOptions';
import NodeResponse from './NodeResponse';

const gzip = promisify(zlib.gzip);

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

function processTlsOptions(tlsOptions: LDTLSOptions): https.AgentOptions {
  const options: https.AgentOptions & { [index: string]: any } = {
    ca: tlsOptions.ca,
    cert: tlsOptions.cert,
    checkServerIdentity: tlsOptions.checkServerIdentity,
    ciphers: tlsOptions.ciphers,
    // Our interface says object for the pfx object. But the node type is more strict.
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

export default class NodeRequests implements platform.Requests {
  private _agent: https.Agent | undefined;

  private _tlsOptions: LDTLSOptions | undefined;

  private _enableBodyCompression: boolean = false;

  constructor(tlsOptions?: LDTLSOptions, enableEventCompression?: boolean) {
    this._agent = tlsOptions ? new https.Agent(processTlsOptions(tlsOptions)) : undefined;
    this._tlsOptions = tlsOptions;
    this._enableBodyCompression = !!enableEventCompression;
  }

  async fetch(url: string, options: platform.Options = {}): Promise<platform.Response> {
    const isSecure = url.startsWith('https://');
    const impl = isSecure ? https : http;

    const headers = { ...options.headers };
    let bodyData: string | Buffer | undefined = options.body;

    if (options.method?.toLowerCase() === 'get') {
      headers['accept-encoding'] = 'gzip';
    } else if (
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
          timeout: options.timeout ?? DEFAULT_REQUEST_TIMEOUT_MS,
          headers,
          method: options.method,
          agent: this._agent,
        },
        (res) => resolve(new NodeResponse(res)),
      );

      if (bodyData) {
        req.write(bodyData);
      }

      req.on('timeout', () => {
        req.destroy(new Error('Request timed out'));
      });

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
}
