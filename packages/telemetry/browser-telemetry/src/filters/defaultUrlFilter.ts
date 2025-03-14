const pollingRegex = /sdk\/evalx\/[^/]+\/contexts\/(?<context>[^/?]*)\??.*?/;
const streamingREgex = /\/eval\/[^/]+\/(?<context>[^/?]*)\??.*?/;

/**
 * Filter which redacts user information (auth) from a URL.
 *
 * If a username/password is present, then they are replaced with 'redacted'.
 * Authority reference: https://developer.mozilla.org/en-US/docs/Web/URI/Authority
 *
 * @param url URL to filter.
 * @returns A filtered URL.
 */
function authorityUrlFilter(url: string): string {
  // This will work in browser environments, but in the future we may want to consider an approach
  // which doesn't rely on the browser's URL parsing. This is because other environments we may
  // want to target, such as ReactNative, may not have as robust URL parsing.
  // We first check if the URL can be parsed, because it may not include the base URL.
  try {
    // If the URL includes a protocol, if so, then it can probably be parsed.
    // Credentials require a full URL.
    if (url.includes('://')) {
      const urlObj = new URL(url);
      let hadAuth = false;
      if (urlObj.username) {
        urlObj.username = 'redacted';
        hadAuth = true;
      }
      if (urlObj.password) {
        urlObj.password = 'redacted';
        hadAuth = true;
      }
      if (hadAuth) {
        return urlObj.toString();
      }
    }
  } catch {
    // Could not parse the URL.
  }
  // If there was no auth information, then we don't need to modify the URL.
  return url;
}

/**
 * Filter which removes context information for browser JavaScript endpoints.
 *
 * @param url URL to filter.
 * @returns A filtered URL.
 */
function ldUrlFilter(url: string): string {
  // TODO: Maybe we consider a way to identify LD requests so they can be filtered without
  // regular expressions.

  if (url.includes('/sdk/evalx')) {
    const regexMatch = url.match(pollingRegex);
    const context = regexMatch?.groups?.context;
    if (context) {
      return url.replace(context, '*'.repeat(context.length));
    }
  }
  if (url.includes('/eval/')) {
    const regexMatch = url.match(streamingREgex);
    const context = regexMatch?.groups?.context;
    if (context) {
      return url.replace(context, '*'.repeat(context.length));
    }
  }
  return url;
}

/**
 * Filter which redacts user information and removes context information for browser JavaScript endpoints.
 *
 * @param url URL to filter.
 * @returns A filtered URL.
 */
export default function defaultUrlFilter(url: string): string {
  return ldUrlFilter(authorityUrlFilter(url));
}
