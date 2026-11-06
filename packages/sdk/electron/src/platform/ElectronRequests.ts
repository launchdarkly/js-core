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
   * event has fired; this method transparently waits for that milestone (which Electron reaches
   * on its own, independent of application code) rather than requiring callers to
   * sequence their own calls around it.
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
    let bodyData: string | Buffer | undefined = options.body;

    // For get requests we are going to automatically support compressed responses.
    // Streaming requests return above, so this does not affect SSE.
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

    // net.fetch has no built-in request timeout, unlike Node's http/https, so we abort the
    // request ourselves and surface it the same way. The timer stops when the headers arrive.
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
        // Node's http/https never followed redirects, sent ambient session credentials, or
        // served requests from a shared cache; net.fetch() defaults to all three (`redirect:
        // 'follow'`, session-ambient auth, `cache: 'default'`). Preserve the prior behavior:
        // surface any redirect as an error instead of silently following it with credentials
        // attached, don't attach ambient session auth, and don't let polling/analytics/
        // diagnostic responses be served from or written into the app's shared HTTP cache.
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
   * The transport for a streaming request. `net.fetch` returns a standard response whose body
   * streams, and it rejects a pending read when the signal aborts. It applies no timeout; the
   * caller owns the read timeout. Chromium negotiates and decodes content encoding by itself.
   *
   * Unlike `fetch`, this follows redirects. `net.fetch` cannot hand a redirect back to the
   * caller (`redirect: 'manual'` cancels the request), and the stream must survive a
   * redirect. Chromium keeps the request headers, the Authorization header included, on each
   * hop.
   */
  private _streamingFetch(url: string, options: platform.Options): Promise<platform.Response> {
    return net.fetch(url, {
      method: options.method,
      headers: options.headers,
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
