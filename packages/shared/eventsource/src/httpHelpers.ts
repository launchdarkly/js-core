/**
 * The structural fetch types below describe the exact subset of the WHATWG fetch API that this
 * package uses.
 *
 * @see https://fetch.spec.whatwg.org/
 *
 * @remark
 * Because they are a structural subset, any standard `fetch` implementation should be able to
 * satisfy `FetchLike` without casts. A platform that cannot use a global `fetch` (for example,
 * one that needs an agent or TLS configuration) supplies its own function with the same shape.
 **/

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
export interface FetchLikeResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headers: FetchHeaders;
  readonly body?: FetchResponseBody | null;
  /**
   * The final response URL, after any redirects. A standard `fetch` response always carries it.
   * The field is optional because a minimal injected transport can omit it; the client then
   * derives the message origin from the request URL.
   */
  readonly url?: string;
}

/**
 * The subset of a fetch `RequestInit` that this package produces.
 *
 * A transport can ignore the fields it has no equivalent for. In particular, a transport over a
 * raw socket API can ignore `credentials`, and it does not need to follow redirects; the client
 * treats a redirect status from such a transport as an ordinary non-200 failure.
 */
export interface FetchLikeOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  credentials?: 'include' | 'same-origin' | 'omit';
}

/**
 * The fetch-shaped transport function. The global `fetch` satisfies this type.
 */
export type FetchLike = (url: string, init: FetchLikeOptions) => Promise<FetchLikeResponse>;

/**
 * The default transport. It reads the global at call time, so a test can replace
 * `globalThis.fetch` after this module loads. The wrapper also avoids an unbound reference to
 * the global function, which some platforms reject.
 */
export const defaultFetch: FetchLike = (url, init) => globalThis.fetch(url, init);

/** The methods for which a `fetch()` request cannot have a body. */
export const bodylessMethods = ['GET', 'HEAD'];

export function headersToObject(headers: FetchHeaders): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/**
 * The `Headers` class of `fetch()` rejects some values through its ByteString conversion: a C0
 * control character other than tab, DEL, and each code point above U+00FF. A value outside the
 * permitted set would make the Last-Event-ID header assignment throw on reconnect. That failure
 * would block the connection permanently.
 *
 * @remark
 * The original `launchdarkly-eventsource` implementation rejects only a NUL character; this stricter
 * rule is what a `fetch()` transport requires.
 */
export const INVALID_HEADER_VALUE_CHAR = /[^\t\x20-\x7e\x80-\xff]/;
