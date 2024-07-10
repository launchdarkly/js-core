import { HttpBreadcrumb } from '../../api/Breadcrumb';

const originalFetch = window.fetch;

export function processProcessFetchArgs(
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
  if (input instanceof Request) {
    url = input.url;
  }
  if (input instanceof URL) {
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
  // TODO: Check if already wrapped?
  // TODO: Centralized mechanism to wrapping?

  function wrapper(...args: any[]): Promise<Response> {
    const timestamp = Date.now();
    // We are taking the original parameters and passing them through. We are not specifying their
    // type information and the number of parameters could be changed over time and the wrapper
    // would still function.
    // @ts-ignore
    return originalFetch.apply(this, args).then((response: Response) => {
      const crumb: HttpBreadcrumb = {
        class: 'http',
        timestamp,
        level: response.ok ? 'info' : 'error',
        type: 'fetch',
        data: {
          // We know these will be fetch args.
          // @ts-ignore
          ...processProcessFetchArgs(...args),
          statusCode: response.status,
          statusText: response.statusText,
        },
      };
      callback(crumb);
      return response;
    });
  }
  wrapper.prototype = originalFetch.prototype;
  // fetch(input: RequestInfo | URL, init?: RequestInit | undefined): Promise<Response>

  try {
    Object.defineProperty(wrapper, '__LaunchDarkly_original_fetch', {
      // Defaults to non-enumerable.
      value: originalFetch,
      writable: true,
      configurable: true,
    });
  } catch {
    // TODO: Debug logs?
  }

  window.fetch = wrapper;
}
