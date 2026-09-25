import * as http from 'http';
import * as https from 'https';
import { promisify } from 'util';
import * as zlib from 'zlib';

import { createEventSource, FetchFn } from '@launchdarkly/eventsource';
import { EventSourceCapabilities, platform } from '@launchdarkly/js-client-sdk-common';

import createElectronFetch from './ElectronFetch';
import ElectronResponse from './ElectronResponse';

const gzip = promisify(zlib.gzip);

export default class ElectronRequests implements platform.Requests {
  private _eventSourceFetch: FetchFn;

  private _enableBodyCompression: boolean = false;

  constructor(enableEventCompression?: boolean) {
    this._eventSourceFetch = createElectronFetch();
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

  createEventSource(
    url: string,
    eventSourceInitDict: platform.EventSourceInitDict,
  ): platform.EventSource {
    return createEventSource(url, {
      ...eventSourceInitDict,
      maxBackoffMillis: 30 * 1000,
      jitterRatio: 0.5,
      fetch: this._eventSourceFetch,
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
