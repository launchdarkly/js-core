/*
 * The structural fetch types below describe the exact subset of the WHATWG fetch API that this
 * package uses. They contain no reference to the DOM `Response`, `Headers`, or `RequestInit`
 * types, so the published declarations resolve everywhere. Because they are a structural subset,
 * a real `fetch` implementation satisfies `FetchFn` without casts. A platform that cannot use a
 * global `fetch` (for example, one that needs an agent or TLS configuration) supplies its own
 * function with the same shape.
 */

/**
 * The response headers. `forEach` is the only member this package reads.
 */
export interface FetchHeaders {
  forEach(callback: (value: string, key: string) => void): void;
}

/**
 * A reader over the response body stream. `read` resolves with the next chunk, or with
 * `done: true` when the server ends the stream, and rejects when the connection drops.
 */
export interface FetchBodyReader {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
}

/**
 * The streamable response body.
 */
export interface FetchResponseBody {
  getReader(): FetchBodyReader;
}

/**
 * The subset of a fetch `Response` that this package uses.
 */
export interface FetchResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headers: FetchHeaders;
  readonly body?: FetchResponseBody | null;
}

/**
 * The subset of a fetch `RequestInit` that this package produces.
 *
 * A transport can ignore the fields it has no equivalent for. In particular, a transport over a
 * raw socket API can ignore `credentials`, and it does not need to follow redirects; the client
 * treats a redirect status from such a transport as an ordinary non-200 failure.
 */
export interface FetchRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  credentials?: 'include' | 'same-origin' | 'omit';
}

/**
 * The fetch-shaped transport function. The global `fetch` satisfies this type.
 */
export type FetchFn = (url: string, init: FetchRequestInit) => Promise<FetchResponse>;

/**
 * The default transport. It reads the global at call time, so a test can replace
 * `globalThis.fetch` after this module loads. The wrapper also avoids an unbound reference to
 * the global function, which some platforms reject.
 */
export const defaultFetch: FetchFn = (url, init) => globalThis.fetch(url, init);

/** The methods for which a `fetch()` request cannot have a body. */
export const bodylessMethods = ['GET', 'HEAD'];

export function headersToObject(headers: FetchHeaders): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}
