import * as http from 'http';
import * as https from 'https';
import { promisify } from 'util';
import * as zlib from 'zlib';

import { createEventSource } from '@launchdarkly/eventsource';
import { EventSourceCapabilities, internal, platform } from '@launchdarkly/js-client-sdk-common';

import type { LDTLSOptions } from '../NodeOptions';
import NodeResponse from './NodeResponse';

const gzip = promisify(zlib.gzip);

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

  private _enableBodyCompression: boolean = false;

  constructor(tlsOptions?: LDTLSOptions, enableEventCompression?: boolean) {
    this._agent = tlsOptions ? new https.Agent(processTlsOptions(tlsOptions)) : undefined;
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
   * The transport for a streaming request. It does not request compressed content. It follows
   * 301 and 307 redirects through `internal.followStreamingRedirects`, and each hop re-sends
   * the method, body, and headers, the Authorization header included, to its redirect target.
   * It applies no read or socket timeout. The caller owns the read timeout and cancels through
   * the abort signal.
   */
  private async _streamingFetch(
    url: string,
    options: platform.Options,
  ): Promise<platform.Response> {
    const requestOptions: https.RequestOptions = {
      method: options.method,
      headers: options.headers,
      agent: this._agent,
      signal: options.signal,
    };
    const doRequest = (requestUrl: string): Promise<http.IncomingMessage> => {
      const impl = requestUrl.startsWith('https://') ? https : http;
      return new Promise<http.IncomingMessage>((resolve, reject) => {
        const req = impl.request(requestUrl, requestOptions, resolve);
        // Send the request headers and body at once, without TCP batching of small writes.
        req.setNoDelay(true);
        // This listener stays attached after resolve. A later socket error then becomes a
        // harmless no-op reject instead of an unhandled 'error' event that would crash the
        // process.
        req.on('error', reject);
        if (options.body !== undefined) {
          req.write(options.body);
        }
        req.end();
      });
    };
    return internal.createStreamingResponse(
      await internal.followStreamingRedirects(url, doRequest),
    );
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
