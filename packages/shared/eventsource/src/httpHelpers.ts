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
 */

/**
 * The response headers. `forEach` is the only member this package reads. It is optional so a
 * transport whose response headers expose no iteration can still satisfy the type. The client
 * then treats the response as carrying no headers.
 */
export interface FetchHeaders {
  forEach?(callback: (value: string, key: string) => void): void;
}

/**
 * A reader over the response body stream. `read` resolves with the next chunk, or with
 * `done: true` when the server ends the stream, and rejects when the connection drops.
 */
export interface FetchBodyReader {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
  /**
   * Releases the reader and its connection. A standard reader always has it; it is optional so a
   * minimal injected transport can omit it. The client calls it on teardown, because the abort
   * signal alone cannot release a transport that ignores the signal.
   */
  cancel?(): Promise<unknown> | void;
}

/**
 * The streamable response body.
 */
export interface FetchResponseBody {
  getReader(): FetchBodyReader;
  /**
   * Releases the body without reading it. A standard fetch body always has it; it is optional
   * so a minimal injected transport can omit it. The client calls it for a response it rejects
   * without reading, because the abort signal alone cannot release a transport that ignores
   * the signal.
   */
  cancel?(): Promise<unknown> | void;
}

/**
 * The subset of a fetch `Response` that this package uses.
 */
export interface FetchLikeResponse {
  readonly status: number;
  /**
   * The HTTP status message. It is optional so a minimal injected transport can omit it. The
   * client then reports an empty message for a failed response.
   */
  readonly statusText?: string;
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
  if (!headers.forEach) {
    // A transport without header iteration reports no headers. The client treats that the same
    // as an empty header set.
    return result;
  }
  headers.forEach((value, key) => {
    // A standard Headers object reports lowercase names. The fold gives a transport that reports
    // wire-cased names the same shape, so a consumer can look a header up by its lowercase name.
    result[key.toLowerCase()] = value;
  });
  return result;
}

/**
 * Splits a joined header value on the commas that sit outside double quotes. A quoted parameter
 * value can legally contain a comma, and a split inside it would break the parameter apart.
 * Empty parts are kept; the caller decides what an empty part means.
 */
export function splitHeaderListValue(value: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let quoted = false;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (quoted && ch === '\\') {
      // A quoted-pair escapes the next character, including a quote or a comma.
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

/**
 * The `Headers` class of `fetch()` rejects some values through its ByteString conversion: a C0
 * control character other than tab, DEL, and each code point above U+00FF. A value outside the
 * permitted set would make the Last-Event-ID header assignment throw on reconnect. That failure
 * would block the connection permanently.
 *
 * @remark
 * The SSE specification rejects only a NUL character in an id. The stricter rule here is what
 * a `fetch()` transport requires.
 */
export const INVALID_HEADER_VALUE_CHAR = /[^\t\x20-\x7e\x80-\xff]/;
