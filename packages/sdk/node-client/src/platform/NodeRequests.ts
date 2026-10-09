import * as http from 'http';
import * as https from 'https';
import { promisify } from 'util';
import * as zlib from 'zlib';

import { createEventSource } from '@launchdarkly/eventsource';
import { EventSourceCapabilities, platform } from '@launchdarkly/js-client-sdk-common';

import type { LDTLSOptions } from '../NodeOptions';
import NodeResponse from './NodeResponse';
import NodeStreamingResponse from './NodeStreamingResponse';

const gzip = promisify(zlib.gzip);

/**
 * The TLS options that are copied onto each streaming `https` request. The names match the
 * options of `https.request()`.
 */
const TLS_OPTION_NAMES = [
  'pfx',
  'key',
  'passphrase',
  'cert',
  'ca',
  'ciphers',
  'rejectUnauthorized',
  'secureProtocol',
  'servername',
  'checkServerIdentity',
] as const;

function tlsRequestOptions(tlsOptions?: LDTLSOptions): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  if (!tlsOptions) {
    return merged;
  }
  const bag = tlsOptions as unknown as Record<string, unknown>;
  TLS_OPTION_NAMES.forEach((name) => {
    if (bag[name] !== undefined) {
      merged[name] = bag[name];
    }
  });
  return merged;
}

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

  private _tlsParams: Record<string, unknown>;

  private _enableBodyCompression: boolean = false;

  constructor(tlsOptions?: LDTLSOptions, enableEventCompression?: boolean) {
    this._agent = tlsOptions ? new https.Agent(processTlsOptions(tlsOptions)) : undefined;
    this._tlsParams = tlsRequestOptions(tlsOptions);
    this._enableBodyCompression = !!enableEventCompression;
  }

  async fetch(url: string, options: platform.Options = {}): Promise<platform.Response> {
    if (options.streaming) {
      return this._streamingFetch(url, options);
    }
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

      req.on('timeout', () => {
        req.destroy(new Error('Request timed out'));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    });
  }

  /**
   * The transport for a streaming request. It does not request compressed content, and it never
   * follows a redirect. A redirect status resolves like any other non-200 response, and the
   * caller decides whether to retry the original URL. It applies no read or socket timeout. The
   * caller owns the read timeout and cancels through the abort signal.
   */
  private _streamingFetch(url: string, options: platform.Options): Promise<platform.Response> {
    const isSecure = url.startsWith('https://');
    const impl = isSecure ? https : http;
    const requestOptions: https.RequestOptions & Record<string, unknown> = {
      method: options.method,
      headers: options.headers,
      agent: this._agent,
    };
    if (isSecure) {
      Object.assign(requestOptions, this._tlsParams);
    }
    return new Promise<platform.Response>((resolve, reject) => {
      const req = impl.request(url, requestOptions, (res) =>
        resolve(new NodeStreamingResponse(res)),
      );
      // An SSE consumer wants each chunk as soon as it arrives; do not batch small writes.
      req.setNoDelay(true);
      const { signal } = options;
      if (signal) {
        const abort = () => req.destroy(new Error('The stream request was aborted'));
        if (signal.aborted) {
          abort();
        } else {
          signal.addEventListener('abort', abort, { once: true });
        }
      }
      // This listener stays attached after resolve. A later socket error then becomes a harmless
      // no-op reject instead of an unhandled 'error' event that would crash the process
      req.on('error', reject);
      if (options.body !== undefined) {
        req.write(options.body);
      }
      req.end();
    });
  }

  createEventSource(
    url: string,
    eventSourceInitDict: platform.EventSourceInitDict,
  ): platform.EventSource {
    return createEventSource(url, {
      ...eventSourceInitDict,
      maxBackoffMillis: 30 * 1000,
      jitterRatio: 0.5,
      fetch: (fetchUrl, init) => this.fetch(fetchUrl, { ...init, streaming: true }),
    });
  }

  getEventSourceCapabilities(): EventSourceCapabilities {
    return {
      readTimeout: true,
      headers: true,
      customMethod: true,
    };
  }
}
