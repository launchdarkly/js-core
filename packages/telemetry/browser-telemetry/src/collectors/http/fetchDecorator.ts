import { HttpBreadcrumb } from '../../api/Breadcrumb';

const LD_ORIGINAL_FETCH = '__LaunchDarkly_original_fetch';

const originalFetch = window.fetch;

/**
 * Given fetch arguments produce a URL and method.
 *
 * Exposed for testing.
 *
 * @param input First parameter to fetch.
 * @param init Second, optional, parameter to fetch.
 * @returns Return the URL and method. If not method or url can be accessed, then 'GET' will be the
 * method and the url will be an empty string.
 */
export function processFetchArgs(
  input: RequestInfo | URL,
  init?: RequestInit | undefined,
): { url: string; method: string } {
  let url = '';
  let method = 'GET';

  if (typeof input === 'string') {
    url = input;
  }
  // We may want to consider prop checks if this ends up being a problem for people.
  // `instanceof` was not added to Edge until 2015.
  if (typeof Request !== 'undefined' && input instanceof Request) {
    url = input.url;
    method = input.method;
  }
  if (typeof URL !== 'undefined' && input instanceof URL) {
    url = input.toString();
  }

  if (init) {
    method = init.method ?? method;
  }
  return { url, method };
}

/**
 * Decorate fetch and execute the callback whenever a fetch is completed providing a breadcrumb.
 *
 * @param callback Function which handles a breadcrumb.
 */
export default function decorateFetch(callback: (breadcrumb: HttpBreadcrumb) => void) {
  // TODO (SDK-884): Check if already wrapped?
  // TODO (SDK-884): Centralized mechanism to wrapping?

  // In this function we add type annotations for `this`. In this case we are telling the compiler
  // we don't care about the typing.

  // This is a function instead of an arrow function in order to preserve the original `this`.
  // Arrow functions capture the enclosing `this`.
  function wrapper(this: any, ...args: any[]): Promise<Response> {
    const timestamp = Date.now();
    // We are taking the original parameters and passing them through. We are not specifying their
    // type information and the number of parameters could be changed over time and the wrapper
    // would still function.
    return originalFetch.apply(this, args as any).then((response: Response) => {
      const crumb: HttpBreadcrumb = {
        class: 'http',
        timestamp,
        level: response.ok ? 'info' : 'error',
        type: 'fetch',
        data: {
          // We know these will be fetch args. We only can take 2 of them, one of which may be
          // undefined. We still use all the ars to apply to the original function.
          ...processFetchArgs(args[0], args[1]),
          statusCode: response.status,
          statusText: response.statusText,
        },
      };
      callback(crumb);
      return response;
    });
  }

  wrapper.prototype = originalFetch?.prototype;

  try {
    // Use defineProperty to prevent this value from being enumerable.
    Object.defineProperty(wrapper, LD_ORIGINAL_FETCH, {
      // Defaults to non-enumerable.
      value: originalFetch,
      writable: true,
      configurable: true,
    });
  } catch {
    // Intentional ignore.
    // TODO: If we add debug logging, then this should be logged.
  }

  window.fetch = wrapper;
}
