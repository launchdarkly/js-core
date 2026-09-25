import * as http from 'http';
import * as https from 'https';

import {
  createEventSource,
  type FetchFn,
  type FetchRequestOptions,
  type FetchResponse,
} from '@launchdarkly/eventsource';
import type { platform } from '@launchdarkly/js-client-sdk-common';

import type { LDTLSOptions } from '../NodeOptions';

/**
 * The TLS options that are copied onto each `https` request. The names match the options of
 * `https.request()`.
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
 * The returned function bakes in the connection configuration: the agent (which can carry proxy
 * or TLS setup) and the TLS parameters for `https` URLs. It never follows a redirect: a redirect
 * status resolves like any other non-200 response, and the caller decides whether to retry the
 * original URL. It applies no read or socket timeout; the caller owns the read timeout and
 * cancels through the request's `AbortSignal`.
 */
export function createNodeFetch(agent?: https.Agent, tlsOptions?: LDTLSOptions): FetchFn {
  const tlsParams = tlsRequestOptions(tlsOptions);
  return async (url: string, init: FetchRequestOptions): Promise<FetchResponse> => {
    const isSecure = url.startsWith('https://');
    const impl = isSecure ? https : http;
    const requestOptions: https.RequestOptions & Record<string, unknown> = {
      method: init.method,
      headers: init.headers,
      agent,
    };
    if (isSecure) {
      Object.assign(requestOptions, tlsParams);
    }
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

export type NodeEventSourceFactory = (
  url: string,
  eventSourceInitDict: platform.EventSourceInitDict,
) => platform.EventSource;

/**
 * Creates the event source factory used by `NodeRequests.createEventSource`.
 *
 * The factory bakes in the connection configuration (agent and TLS parameters, through the fetch
 * adapter above) and the SDK retry policy (backoff cap and jitter).
 */
export default function createNodeEventSourceFactory(
  agent?: https.Agent,
  tlsOptions?: LDTLSOptions,
): NodeEventSourceFactory {
  const fetch = createNodeFetch(agent, tlsOptions);
  return (url, eventSourceInitDict) =>
    createEventSource(url, {
      ...eventSourceInitDict,
      maxBackoffMillis: 30 * 1000,
      jitterRatio: 0.5,
      fetch,
    });
}
