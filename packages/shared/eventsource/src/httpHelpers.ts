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
 * The response headers. The member set mirrors the subset of the standard `Headers` class that
 * this package reads.
 */
export interface FetchHeaders {
  /**
   * Returns the value of a header, or `null` when the response carries no such header. The
   * lookup is case-insensitive, like the standard `Headers.get`. The client validates the
   * declared content type through it.
   */
  get(name: string): string | null;

  /**
   * Executes the callback once for each header, with the value first. It is optional so a
   * transport whose response headers expose no iteration can still satisfy the type.
   */
  forEach?(callback: (value: string, key: string) => void): void;

  /**
   * Returns an iterator over the header name-value pairs, like the standard
   * `Headers.entries`. It is the iteration fallback when `forEach` is absent.
   */
  entries?(): Iterable<[string, string]>;
}

/**
 * A reader over the response body stream. `read` resolves with the next chunk, or with
 * `done: true` when the server ends the stream, and rejects when the connection terminates
 * before the server ends the stream.
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

/**
 * Collects the headers into a plain record. Returns `null` when the headers object provides
 * no iteration method at all, so the caller can tell an unreadable header set from an empty
 * one. A standard Headers object reports lowercase names, so names fold to lowercase. The
 * fold gives a transport that reports wire-cased names the same shape.
 */
export function headersToObject(headers: FetchHeaders): Record<string, string> | null {
  const result: Record<string, string> = {};
  if (headers.forEach) {
    headers.forEach((value, key) => {
      result[key.toLowerCase()] = value;
    });
    return result;
  }
  if (headers.entries) {
    Array.from(headers.entries()).forEach(([key, value]) => {
      result[key.toLowerCase()] = value;
    });
    return result;
  }
  return null;
}

/**
 * The response headers in the shape the client consumes. `contentType` is the declared
 * content type, or `undefined` when the response declares none. `unreadable` is true when
 * no header access works at all.
 */
export interface ParsedResponseHeaders {
  headers: Record<string, string>;
  contentType: string | undefined;
  unreadable: boolean;
}

/**
 * Reads and validates the headers of a response. Every access to the headers object is
 * guarded, so a hostile response cannot break the failure report with a throw. The declared
 * content type prefers the `get` lookup and falls back to the iterated record.
 */
export function parseResponseHeaders(res: FetchLikeResponse): ParsedResponseHeaders {
  let resHeaders: FetchHeaders | undefined;
  try {
    ({ headers: resHeaders } = res);
  } catch {
    resHeaders = undefined;
  }
  if (resHeaders === undefined || resHeaders === null) {
    return { headers: {}, contentType: undefined, unreadable: true };
  }

  let headers: Record<string, string> = {};
  let iterated = false;
  let unreadable = false;
  try {
    const collected = headersToObject(resHeaders);
    iterated = collected !== null;
    headers = collected ?? {};
  } catch {
    unreadable = true;
  }

  // `getResult` holds what `get` returned. `getAnsweredAbsent` is true only when a working
  // `get` reported the header as absent, which is the one case where a missing record is
  // not a failure.
  let getResult: unknown;
  let getAnsweredAbsent = false;
  try {
    if (typeof resHeaders.get === 'function') {
      getResult = resHeaders.get('content-type');
      getAnsweredAbsent = getResult === null || getResult === undefined;
    }
  } catch {
    // A throwing get leaves the declared type to the iterated record.
    getResult = undefined;
  }

  let contentType: string | undefined;
  if (typeof getResult === 'string') {
    contentType = getResult;
  } else if (iterated) {
    contentType = headers['content-type'];
  } else if (!getAnsweredAbsent) {
    unreadable = true;
  }

  return { headers, contentType, unreadable };
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
