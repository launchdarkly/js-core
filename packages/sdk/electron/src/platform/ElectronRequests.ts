import * as http from 'http';
import * as https from 'https';
import { promisify } from 'util';
import * as zlib from 'zlib';

import { createEventSource } from '@launchdarkly/eventsource';
import { EventSourceCapabilities, internal, platform } from '@launchdarkly/js-client-sdk-common';

import ElectronResponse from './ElectronResponse';

const gzip = promisify(zlib.gzip);

export default class ElectronRequests implements platform.Requests {
  private _enableBodyCompression: boolean = false;

  constructor(enableEventCompression?: boolean) {
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

    // For get requests we are going to automatically support compressed responses.
    // Note this does not affect SSE as streaming requests take the branch above.
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
        },
        (res) => resolve(new ElectronResponse(res)),
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

  /**
   * The transport for a streaming request. This SDK exposes no agent, proxy, or TLS options, so
   * the running machine's own network configuration applies and TLS verification follows the
   * platform default. It does not request compressed content, and it never follows a redirect.
   * A redirect status resolves like any other non-200 response, and the caller decides whether
   * to retry the original URL. It applies no read or socket timeout. The caller owns the read
   * timeout and cancels through the abort signal.
   */
  private _streamingFetch(url: string, options: platform.Options): Promise<platform.Response> {
    const isSecure = url.startsWith('https://');
    const impl = isSecure ? https : http;
    const requestOptions: https.RequestOptions = {
      method: options.method,
      headers: options.headers,
    };
    return new Promise<platform.Response>((resolve, reject) => {
      const req = impl.request(url, requestOptions, (res) =>
        resolve(internal.createStreamingResponse(res)),
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
