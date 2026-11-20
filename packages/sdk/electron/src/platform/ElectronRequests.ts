import { app, net } from 'electron';
import { promisify } from 'util';
import * as zlib from 'zlib';

import { createEventSource } from '@launchdarkly/eventsource';
import { EventSourceCapabilities, platform } from '@launchdarkly/js-client-sdk-common';

const gzip = promisify(zlib.gzip);

export default class ElectronRequests implements platform.Requests {
  private _enableBodyCompression: boolean = false;

  constructor(enableEventCompression?: boolean) {
    this._enableBodyCompression = !!enableEventCompression;
  }

  /**
   * Uses Electron's `net` module (Chromium's networking stack) for streaming, polling,
   * analytics, and diagnostic requests. The `net` module is only usable once Electron's `ready`
   * event has fired. This method waits for that event, so callers do not have to.
   *
   * https://www.electronjs.org/docs/latest/api/net
   */
  async fetch(url: string, options: platform.Options = {}): Promise<platform.Response> {
    if (!app.isReady()) {
      await app.whenReady();
    }

    if (options.streaming) {
      return this._streamingFetch(url, options);
    }

    const headers = { ...options.headers };
    let bodyData: string | Uint8Array<ArrayBuffer> | undefined = options.body;

    // For get requests we are going to automatically support compressed responses.
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
      // The net.fetch body type accepts only a view backed by an ArrayBuffer. A Buffer has
      // the wider ArrayBufferLike type, so copy it into a plain Uint8Array.
      bodyData = new Uint8Array(await gzip(Buffer.from(options.body, 'utf8')));
    }

    // net.fetch applies no timeout. This timer limits only the wait for the response
    // headers. It stops when the headers arrive, so it does not limit the body read.
    const controller = new AbortController();
    let timedOut = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    if (options.timeout && options.timeout > 0) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, options.timeout);
    }

    try {
      return await net.fetch(url, {
        method: options.method,
        headers,
        body: bodyData,
        signal: controller.signal,
        // A redirect fails the request, so the SDK key never follows it to another host.
        // Ambient session credentials stay off. Responses never come from, or go into,
        // the app's shared HTTP cache.
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
      });
    } catch (err) {
      if (timedOut) {
        throw new Error('Request timed out');
      }
      throw err;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  /**
   * Sends a streaming request. `net.fetch` returns a standard response whose body
   * streams, and it rejects a pending read when the signal aborts. It applies no timeout; the
   * caller owns the read timeout. It asks for an uncompressed body, so that a proxy
   * does not hold events back in a compression buffer.
   *
   * Unlike `fetch`, this follows redirects. `net.fetch` cannot hand a redirect back to the
   * caller (`redirect: 'manual'` cancels the request), and the stream must survive a
   * redirect. Chromium follows 301, 302, 303, 307 and 308, up to 20 hops. It keeps the
   * request headers on each hop, the Authorization header included, also to another
   * origin. A 303 changes the method to GET and drops the body.
   */
  private _streamingFetch(url: string, options: platform.Options): Promise<platform.Response> {
    return net.fetch(url, {
      method: options.method,
      headers: { ...options.headers, 'accept-encoding': 'identity' },
      body: options.body,
      signal: options.signal,
      redirect: 'follow',
      credentials: 'omit',
      cache: 'no-store',
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
