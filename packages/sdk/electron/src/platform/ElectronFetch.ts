import * as http from 'http';
import * as https from 'https';

import type { FetchFn, FetchRequestInit, FetchResponse } from '@launchdarkly/eventsource';

function wrapResponse(res: http.IncomingMessage): FetchResponse {
  // The async iterator hands out one chunk per read. It resolves done when the server ends the
  // stream, and it rejects when the connection drops or the request is destroyed.
  const iterator = res[Symbol.asyncIterator]();
  return {
    status: res.statusCode ?? 0,
    statusText: res.statusMessage ?? '',
    headers: {
      forEach(callback: (value: string, key: string) => void): void {
        Object.entries(res.headers).forEach(([key, value]) => {
          if (value === undefined) {
            return;
          }
          callback(Array.isArray(value) ? value.join(', ') : value, key);
        });
      },
    },
    body: {
      getReader: () => ({
        read: async () => {
          const next = await iterator.next();
          if (next.done) {
            return { done: true };
          }
          return { done: false, value: next.value as Uint8Array };
        },
      }),
    },
  };
}

/**
 * Creates a `fetch()`-shaped function over `node:http`/`node:https` for the SSE stream.
 *
 * The Electron SDK exposes no agent, proxy, or TLS options: the running machine's own network
 * configuration applies, and TLS verification follows the platform default. The returned function
 * never follows a redirect: a redirect status resolves like any other non-200 response, and the
 * caller decides whether to retry the original URL. It applies no read or socket timeout; the
 * caller owns the read timeout and cancels through the request's `AbortSignal`.
 */
export default function createElectronFetch(): FetchFn {
  return async (url: string, init: FetchRequestInit): Promise<FetchResponse> => {
    const isSecure = url.startsWith('https://');
    const impl = isSecure ? https : http;
    const requestOptions: https.RequestOptions = {
      method: init.method,
      headers: init.headers,
    };
    return new Promise<FetchResponse>((resolve, reject) => {
      const req = impl.request(url, requestOptions, (res) => resolve(wrapResponse(res)));
      // An SSE consumer wants each chunk as soon as it arrives; do not batch small writes.
      req.setNoDelay(true);
      const { signal } = init;
      if (signal) {
        const abort = () => req.destroy(new Error('The stream request was aborted'));
        if (signal.aborted) {
          abort();
        } else {
          signal.addEventListener('abort', abort, { once: true });
        }
      }
      // stays attached after resolve, so a later socket error becomes a harmless no-op reject
      // instead of an unhandled 'error' event that would crash the process
      req.on('error', reject);
      if (init.body !== undefined) {
        req.write(init.body);
      }
      req.end();
    });
  };
}
