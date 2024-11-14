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
}

/**
 * Interface for fetch responses.
 */
export interface Response {
  headers: Headers;
  status: number;

  /**
   * Read the response and provide it as a string.
   */
  text(): Promise<string>;

  /**
   * Read the response and provide it as decoded json.
   */
  json(): Promise<any>;
}

export interface Options {
  headers?: Record<string, string>;
  method?: string;
  body?: string;
  timeout?: number;
  /**
   * For use in browser environments. Platform support will be best effort for this field.
   * https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#keepalive
   */
  keepalive?: boolean;
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
}
