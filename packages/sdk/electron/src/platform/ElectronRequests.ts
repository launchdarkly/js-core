import { app as electronApp, net as electronNet } from 'electron';
import type { ClientRequest, IncomingMessage } from 'electron';
// No types for the event source.
// @ts-ignore
import { EventSource as LDEventSource } from 'launchdarkly-eventsource';
import { promisify } from 'util';
import * as zlib from 'zlib';

import { EventSourceCapabilities, platform } from '@launchdarkly/js-client-sdk-common';

import ElectronResponse from './ElectronResponse';

const gzip = promisify(zlib.gzip);

export default class ElectronRequests implements platform.Requests {
  private _enableBodyCompression: boolean = false;

  constructor(enableEventCompression?: boolean) {
    this._enableBodyCompression = !!enableEventCompression;
  }

  /**
   * Uses Electron's `net` module (Chromium's networking stack) for polling, analytics,
   * and diagnostic requests. The `net` module is only usable once Electron's `ready` event
   * has fired; this method transparently waits for that milestone (which Electron reaches
   * on its own, independent of application code) rather than requiring callers to
   * sequence their own calls around it.
   *
   * https://www.electronjs.org/docs/latest/api/net
   */
  async fetch(url: string, options: platform.Options = {}): Promise<platform.Response> {
    if (!electronApp.isReady()) {
      await electronApp.whenReady();
    }

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
      const req: ClientRequest = electronNet.request({
        method: options.method,
        url,
        // Node's http/https never followed redirects, sent ambient session credentials, or
        // served requests from a shared cache; net.request() defaults to all three (`redirect:
        // 'follow'`, session-ambient auth, `cache: 'default'`). Preserve the prior behavior:
        // surface any redirect as an error instead of silently following it with credentials
        // attached, don't attach ambient session auth, and don't let polling/analytics/
        // diagnostic responses be served from or written into the app's shared HTTP cache.
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
      });

      Object.entries(headers).forEach(([name, value]) => {
        if (value !== undefined) {
          req.setHeader(name, value);
        }
      });

      // The net module has no built-in request timeout, unlike Node's http/https,
      // so we abort the request ourselves and surface it the same way.
      let timedOut = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      if (options.timeout && options.timeout > 0) {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          req.abort();
        }, options.timeout);
      }
      const clearRequestTimeout = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      };

      req.on('response', (res: IncomingMessage) => {
        clearRequestTimeout();
        resolve(new ElectronResponse(res));
      });

      // abort() only emits 'abort' (and then 'close'), not 'error', so a
      // self-triggered timeout must be surfaced here rather than in 'error'.
      req.on('abort', () => {
        clearRequestTimeout();
        if (timedOut) {
          reject(new Error('Request timed out'));
        }
      });

      req.on('error', (err) => {
        clearRequestTimeout();
        reject(err);
      });

      if (bodyData) {
        req.write(bodyData);
      }

      req.end();
    });
  }

  createEventSource(
    url: string,
    eventSourceInitDict: platform.EventSourceInitDict,
  ): platform.EventSource {
    const expandedOptions = {
      ...eventSourceInitDict,
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
