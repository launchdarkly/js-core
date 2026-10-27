import type { RawHeaders } from './StreamingResponse';

/**
 * The most redirect hops one streaming request follows. When a chain exceeds the cap, the last
 * redirect response goes to the caller as an ordinary non-200 response. The caller's error
 * handling decides whether to retry.
 */
export const MAX_STREAMING_REDIRECT_HOPS = 5;

/**
 * The response shape the redirect loop inspects. A Node `IncomingMessage` satisfies it.
 */
export interface RedirectResponseSource {
  statusCode?: number;
  headers: RawHeaders;

  /**
   * Destroys the stream, so a followed redirect response releases its connection at once. A
   * source without it leaves the skipped body to the socket teardown.
   */
  destroy?(): unknown;
}

/**
 * Resolves the target of a redirect response. The target can be relative, and it resolves
 * against the URL of the redirected request. Only an `http:` or `https:` target can carry
 * the stream; any other scheme, a missing or empty `Location`, and an unparsable value all
 * resolve to `undefined`, and the redirect response then goes to the caller unfollowed.
 */
function redirectTarget(headers: RawHeaders, baseUrl: string): string | undefined {
  const raw = headers.location;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || value === '') {
    return undefined;
  }
  try {
    const resolved = new URL(value, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return undefined;
    }
    return resolved.href;
  } catch {
    return undefined;
  }
}

/**
 * Issues a streaming request and follows up to {@link MAX_STREAMING_REDIRECT_HOPS} hops of
 * `301` and `307` redirects. Each hop calls `doRequest` again with the target URL, so the
 * request carries the same method, body, and headers to each target, the `Authorization`
 * header included. A `302` and every other status return to the caller unfollowed.
 *
 * The loop holds no state across calls. A reconnect starts from the original URL again and
 * re-follows the chain.
 *
 * @param url The URL of the initial request.
 * @param doRequest Issues one request and resolves with its response. The caller builds the
 * options inside it from the given URL, so each hop gets options for its own target.
 */
export async function followStreamingRedirects<T extends RedirectResponseSource>(
  url: string,
  doRequest: (requestUrl: string) => Promise<T>,
): Promise<T> {
  let currentUrl = url;
  let res = await doRequest(currentUrl);
  let hops = 0;
  while ((res.statusCode === 301 || res.statusCode === 307) && hops < MAX_STREAMING_REDIRECT_HOPS) {
    const target = redirectTarget(res.headers, currentUrl);
    if (target === undefined) {
      return res;
    }
    hops += 1;
    // The destroy releases the skipped redirect response and its connection at once, so a
    // redirect body that never ends cannot hold a socket for the life of the attempt.
    try {
      res.destroy?.();
    } catch {
      // A throwing destroy has nothing left to release.
    }
    currentUrl = target;
    // The hops are sequential. The next request cannot start until this response arrives.
    // eslint-disable-next-line no-await-in-loop
    res = await doRequest(currentUrl);
  }
  return res;
}
