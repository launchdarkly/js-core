// The interfaces in this file are intended to be as close as possible to the
// interfaces used for the `fetch` Web API. Doing so should allow implementations
// which are more easily portable.
import type { EventSource, EventSourceInitDict } from './EventSource';

// These are not full specifications of the interface, but instead subsets
// based on the functionality needed by the SDK. Exposure of the full standard
// would require much more per platform implementation for platforms that do not
// natively support fetch.

/**
 * Interface for headers that are part of a fetch response.
 */
export interface Headers {
  /**
   * Get a header by name.
   *
   * https://developer.mozilla.org/en-US/docs/Web/API/Headers/get
   *
   * @param name The name of the header to get.
   */
  get(name: string): string | null;

  /**
   * Returns an iterator allowing iteration of all the keys contained
   * in this object.
   *
   * https://developer.mozilla.org/en-US/docs/Web/API/Headers/keys
   *
   */
  keys(): Iterable<string>;

  /**
   * Returns an iterator allowing iteration of all the values contained
   * in this object.
   *
   * https://developer.mozilla.org/en-US/docs/Web/API/Headers/values
   */
  values(): Iterable<string>;

  /**
   * Returns an iterator allowing iteration of all the key-value pairs in
   * the object.
   *
   * https://developer.mozilla.org/en-US/docs/Web/API/Headers/entries
   */
  entries(): Iterable<[string, string]>;

  /**
   * Returns true if the header is present.
   * @param name The name of the header to check.
   */
  has(name: string): boolean;

  /**
   * Executes the callback once for each header, with the value first. Optional so existing
   * implementations remain valid. A streaming implementation must provide it. The streaming
   * client reads headers only through this method, and content-type validation stops working
   * without it.
   *
   * https://developer.mozilla.org/en-US/docs/Web/API/Headers/forEach
   */
  forEach?(callback: (value: string, key: string) => void): void;
}

/**
 * A reader over a response body stream.
 */
export interface BodyReader {
  /**
   * Resolves with the next chunk, or with `done: true` when the server ends the stream.
   * Rejects when the connection drops.
   */
  read(): Promise<{ done: boolean; value?: Uint8Array }>;

  /**
   * Releases the reader and its connection.
   */
  cancel?(): Promise<unknown> | void;
}

/**
 * A response body stream.
 */
export interface ResponseBody {
  getReader(): BodyReader;

  /**
   * Releases the body without reading it.
   */
  cancel?(): Promise<unknown> | void;
}

/**
 * Interface for fetch responses.
 */
export interface Response {
  headers: Headers;
  status: number;

  /**
   * The HTTP status message of the response. Optional so existing implementations remain
   * valid.
   *
   * https://developer.mozilla.org/en-US/docs/Web/API/Response/statusText
   */
  statusText?: string;

  /**
   * The response body stream. An implementation provides it for a request made with
   * {@link Options.streaming}. It can also provide it for other requests.
   *
   * https://developer.mozilla.org/en-US/docs/Web/API/Response/body
   */
  body?: ResponseBody | null;

  /**
   * Read the response and provide it as a string.
   */
  text(): Promise<string>;

  /**
   * Read the response and provide it as decoded json.
   */
  json(): Promise<any>;
}

/**
 * The platform's own `AbortSignal` type when the platform declares one on the global scope.
 * An implementation that passes {@link Options} to a native `fetch` therefore type-checks
 * against its platform's `RequestInit`. The fallback is the minimal structural subset an
 * implementation consumes, which keeps these declarations valid on a platform without the
 * global.
 */
export type AbortSignalLike = typeof globalThis extends { AbortSignal: { prototype: infer T } }
  ? T
  : {
      readonly aborted: boolean;
      addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
      removeEventListener(type: 'abort', listener: () => void): void;
    };

export interface Options {
  headers?: Record<string, string>;
  method?: string;
  body?: string;
  /**
   * Gzip compress the post body only if the underlying SDK framework supports it
   * and the config option enableEventCompression is set to true.
   */
  compressBodyIfPossible?: boolean;
  timeout?: number;
  /**
   * For use in browser environments. Platform support will be best effort for this field.
   * https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#keepalive
   */
  keepalive?: boolean;

  /**
   * An abort signal for the request. When the signal aborts, the implementation stops the
   * request and rejects any pending read. Platform support for this field is best effort.
   *
   * https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#signal
   */
  signal?: AbortSignalLike;

  /**
   * True for a streaming request. The implementation delivers response chunks with low
   * latency. It does not request compressed content, does not buffer the response body,
   * and applies no request timeout. The response exposes its body through
   * {@link Response.body}. An SDK must use a fetch as a streaming transport only when the
   * implementation honors this field. A streaming implementation must provide at least one
   * release path. It honors {@link Options.signal}, or it provides the body cancel. It
   * preferably provides both. When `streaming` is true, the implementation ignores
   * {@link Options.timeout}.
   */
  streaming?: boolean;
}

/**
 * Converts the request options into the init shape a platform's native `fetch` accepts. A
 * platform can declare its `AbortSignal` as a lexical class, which {@link AbortSignalLike}
 * cannot resolve to, so the `signal` member widens here. The runtime value is always a real
 * signal for the running platform, so the widening only restores the type the runtime
 * already has.
 */
export function toRequestInit(options: Options): Omit<Options, 'signal'> & { signal?: any } {
  return options;
}

export interface EventSourceCapabilities {
  /**
   * If true the event source supports read timeouts. A read timeout for an
   * event source represents the maximum time between receiving any data.
   * If you receive 1 byte, and then a period of time greater than the read
   * time out elapses, and you do not receive a second byte, then that would
   * cause the event source to timeout.
   *
   * It is not a timeout for the read of the entire body, which should be
   * indefinite.
   */
  readTimeout: boolean;

  /**
   * If true the event source supports customized verbs POST/REPORT instead of
   * only the default GET.
   */
  customMethod: boolean;

  /**
   * If true the event source supports setting HTTP headers.
   */
  headers: boolean;
}

export interface Requests {
  fetch(url: string, options?: Options): Promise<Response>;

  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource;

  getEventSourceCapabilities(): EventSourceCapabilities;

  /**
   * Returns true if a proxy is configured.
   */
  usingProxy?(): boolean;

  /**
   * Returns true if the proxy uses authentication.
   */
  usingProxyAuth?(): boolean;
}

export interface HttpErrorResponse {
  message: string;
  status?: number;
  headers?: Record<string, string>;
}
