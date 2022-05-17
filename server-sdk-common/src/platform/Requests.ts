import LDProxyOptions from '../api/options/LDProxyOptions';
import { LDTLSOptions } from '../api/options/LDTLSOptions';

// The interfaces in this file are intended to be as close as possible to the
// interfaces used for the `fetch` Web API. Doing so should allow implementations
// which are more easily porable.

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
   * @param name The name of the header to get.
   */
  get(name: string): string | string[] | undefined ;
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
  headers?: Record<string, string>
  method?: string;
  body?: string
  timeout?: number;

  /**
   * Allows specification of TLS options. May not be supported on all platforms.
   *
   * This is not part of the `fetch` Web API.
   */
  tlsOptions?: LDTLSOptions;
  /**
   * Allows specification of proxy options. May not be supported on all platforms.
   *
   * This is not part of the `fetch` Web API.
   */
  proxyOptions?: LDProxyOptions;
}

export default interface Requests {
  fetch(url: string, options: Options): Promise<Response>
}
